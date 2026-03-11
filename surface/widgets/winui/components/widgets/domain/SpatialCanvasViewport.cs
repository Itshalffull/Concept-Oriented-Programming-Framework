// ============================================================
// Clef Surface WinUI Widget — SpatialCanvasViewport
//
// Primary spatial editing surface using Win2D CanvasControl
// for high-performance 2D rendering within WinUI 3 / XAML.
// Implements the spatial-canvas-viewport.widget spec: camera
// transforms (pan/zoom-at-point), layered rendering (grid,
// items, connectors, selection marquee), viewport culling,
// and the full state machine (idle, panning, selecting, contextMenu).
// ============================================================

using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Microsoft.Graphics.Canvas;
using Microsoft.Graphics.Canvas.Geometry;
using Microsoft.Graphics.Canvas.UI.Xaml;
using Microsoft.UI;
using Microsoft.UI.Input;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Windows.Foundation;
using Windows.System;
using Windows.UI;

namespace Clef.Surface.WinUI.Widgets.Domain;

// ---- Data types -----------------------------------------------------------

public record struct SpatialCanvasItem(
    string Id, float X, float Y, float Width, float Height, string Type);

public record struct SpatialCanvasConnector(
    string Id, string SourceId, string TargetId, string LineStyle);

public record struct SpatialCamera(float X, float Y, float Zoom)
{
    public static SpatialCamera Default => new(0, 0, 1f);
}

// ---- State machine --------------------------------------------------------

public enum ViewportInteraction { Idle, Panning, Selecting, ContextMenu }

// ---- Events ---------------------------------------------------------------

public sealed class CameraChangedEventArgs : EventArgs
{
    public SpatialCamera Camera { get; init; }
}

public sealed class SelectionChangedEventArgs : EventArgs
{
    public IReadOnlyList<string> SelectedIds { get; init; } = Array.Empty<string>();
}

public sealed class ItemPressedEventArgs : EventArgs
{
    public string ItemId { get; init; } = "";
    public Point Position { get; init; }
}

// ---- Widget ---------------------------------------------------------------

public sealed class SpatialCanvasViewport : UserControl
{
    // --- Dependency properties ------------------------------------------------

    public static readonly DependencyProperty CanvasIdProperty =
        DependencyProperty.Register(nameof(CanvasId), typeof(string),
            typeof(SpatialCanvasViewport), new PropertyMetadata(""));

    public static readonly DependencyProperty CanvasNameProperty =
        DependencyProperty.Register(nameof(CanvasName), typeof(string),
            typeof(SpatialCanvasViewport), new PropertyMetadata(""));

    public static readonly DependencyProperty GridVisibleProperty =
        DependencyProperty.Register(nameof(GridVisible), typeof(bool),
            typeof(SpatialCanvasViewport), new PropertyMetadata(true, OnVisualPropertyChanged));

    public static readonly DependencyProperty GridSizeProperty =
        DependencyProperty.Register(nameof(GridSize), typeof(int),
            typeof(SpatialCanvasViewport), new PropertyMetadata(20, OnVisualPropertyChanged));

    public static readonly DependencyProperty GridStyleProperty =
        DependencyProperty.Register(nameof(GridStyle), typeof(string),
            typeof(SpatialCanvasViewport), new PropertyMetadata("dots", OnVisualPropertyChanged));

    public static readonly DependencyProperty BackgroundFillProperty =
        DependencyProperty.Register(nameof(BackgroundFill), typeof(Color),
            typeof(SpatialCanvasViewport), new PropertyMetadata(Color.FromArgb(255, 250, 250, 250), OnVisualPropertyChanged));

    public string CanvasId { get => (string)GetValue(CanvasIdProperty); set => SetValue(CanvasIdProperty, value); }
    public string CanvasName { get => (string)GetValue(CanvasNameProperty); set => SetValue(CanvasNameProperty, value); }
    public bool GridVisible { get => (bool)GetValue(GridVisibleProperty); set => SetValue(GridVisibleProperty, value); }
    public int GridSize { get => (int)GetValue(GridSizeProperty); set => SetValue(GridSizeProperty, value); }
    public string GridStyle { get => (string)GetValue(GridStyleProperty); set => SetValue(GridStyleProperty, value); }
    public Color BackgroundFill { get => (Color)GetValue(BackgroundFillProperty); set => SetValue(BackgroundFillProperty, value); }

    // --- Properties ---

    public SpatialCamera Camera { get; set; } = SpatialCamera.Default;
    public float ZoomMin { get; set; } = 0.1f;
    public float ZoomMax { get; set; } = 5.0f;
    public bool SnapToGrid { get; set; } = true;
    public List<SpatialCanvasItem> Items { get; set; } = new();
    public List<SpatialCanvasConnector> Connectors { get; set; } = new();
    public HashSet<string> SelectedItemIds { get; set; } = new();

    // --- Events ---

    public event EventHandler<CameraChangedEventArgs>? CameraChanged;
    public event EventHandler<SelectionChangedEventArgs>? SelectionChanged;
    public event EventHandler<ItemPressedEventArgs>? ItemPressed;
    public event EventHandler? DeleteRequested;

    // --- Internal state ---

    private readonly CanvasControl _canvasControl;
    private ViewportInteraction _interaction = ViewportInteraction.Idle;
    private Point _panAnchor;
    private SpatialCamera _panCameraAnchor;
    private Point _marqueeStartWorld;
    private Point _marqueeEndWorld;
    private readonly List<string> _marqueeSelectedIds = new();

    // ---- Constructor ----------------------------------------------------------

    public SpatialCanvasViewport()
    {
        _canvasControl = new CanvasControl();
        _canvasControl.Draw += OnDraw;
        Content = _canvasControl;

        // Pointer events
        _canvasControl.PointerPressed += OnCanvasPointerPressed;
        _canvasControl.PointerMoved += OnCanvasPointerMoved;
        _canvasControl.PointerReleased += OnCanvasPointerReleased;
        _canvasControl.PointerWheelChanged += OnCanvasPointerWheelChanged;

        // Keyboard
        IsTabStop = true;
        KeyDown += OnKeyDownHandler;

        // Accessibility
        AutomationProperties.SetName(this, "Canvas");
        AutomationProperties.SetLocalizedControlType(this, "spatial canvas");
    }

    // ---- Coordinate transforms -----------------------------------------------

    private Point ScreenToWorld(Point screen)
    {
        var localX = screen.X;
        var localY = screen.Y;
        return new Point(
            localX / Camera.Zoom - Camera.X,
            localY / Camera.Zoom - Camera.Y);
    }

    private Point WorldToScreen(Point world)
    {
        return new Point(
            (world.X + Camera.X) * Camera.Zoom,
            (world.Y + Camera.Y) * Camera.Zoom);
    }

    // ---- Viewport culling ----------------------------------------------------

    private IEnumerable<SpatialCanvasItem> VisibleItems()
    {
        var vpWidth = (float)ActualWidth;
        var vpHeight = (float)ActualHeight;
        var left = -Camera.X;
        var top = -Camera.Y;
        var right = left + vpWidth / Camera.Zoom;
        var bottom = top + vpHeight / Camera.Zoom;

        return Items.Where(item =>
            item.X + item.Width >= left && item.X <= right &&
            item.Y + item.Height >= top && item.Y <= bottom);
    }

    // ---- Hit test ------------------------------------------------------------

    private SpatialCanvasItem? HitItem(Point worldPoint)
    {
        return Items.FirstOrDefault(item =>
            worldPoint.X >= item.X && worldPoint.X <= item.X + item.Width &&
            worldPoint.Y >= item.Y && worldPoint.Y <= item.Y + item.Height);
    }

    // ---- Zoom at point -------------------------------------------------------

    private void ZoomAtPoint(float delta, Point localPoint)
    {
        var factor = delta > 0 ? 1.05f : 0.95f;
        var nextZoom = Math.Clamp(Camera.Zoom * factor, ZoomMin, ZoomMax);
        var worldX = (float)(localPoint.X / Camera.Zoom - Camera.X);
        var worldY = (float)(localPoint.Y / Camera.Zoom - Camera.Y);
        Camera = new SpatialCamera(
            (float)(localPoint.X / nextZoom) - worldX,
            (float)(localPoint.Y / nextZoom) - worldY,
            nextZoom);
        CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
        _canvasControl.Invalidate();
    }

    // ---- Marquee selection ---------------------------------------------------

    private void ComputeMarqueeSelection()
    {
        var left = Math.Min(_marqueeStartWorld.X, _marqueeEndWorld.X);
        var right = Math.Max(_marqueeStartWorld.X, _marqueeEndWorld.X);
        var top = Math.Min(_marqueeStartWorld.Y, _marqueeEndWorld.Y);
        var bottom = Math.Max(_marqueeStartWorld.Y, _marqueeEndWorld.Y);

        _marqueeSelectedIds.Clear();
        _marqueeSelectedIds.AddRange(
            Items.Where(item =>
                item.X + item.Width >= left && item.X <= right &&
                item.Y + item.Height >= top && item.Y <= bottom)
            .Select(item => item.Id));
    }

    // ---- Pointer events ------------------------------------------------------

    private void OnCanvasPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        Focus(FocusState.Programmatic);
        var props = e.GetCurrentPoint(_canvasControl).Properties;
        var pos = e.GetCurrentPoint(_canvasControl).Position;
        var worldPt = ScreenToWorld(pos);

        // Right click => context menu
        if (props.IsRightButtonPressed)
        {
            _interaction = ViewportInteraction.ContextMenu;
            _canvasControl.Invalidate();
            return;
        }

        // Check item hit
        var hitItem = HitItem(worldPt);
        if (hitItem.HasValue)
        {
            ItemPressed?.Invoke(this, new ItemPressedEventArgs
            {
                ItemId = hitItem.Value.Id,
                Position = pos,
            });
            return;
        }

        // Middle button or Shift => pan
        if (props.IsMiddleButtonPressed || e.KeyModifiers.HasFlag(VirtualKeyModifiers.Shift))
        {
            _interaction = ViewportInteraction.Panning;
            _panAnchor = pos;
            _panCameraAnchor = Camera;
            _canvasControl.CapturePointer(e.Pointer);
            return;
        }

        // Left click on empty => marquee
        _interaction = ViewportInteraction.Selecting;
        _marqueeStartWorld = worldPt;
        _marqueeEndWorld = worldPt;
        _marqueeSelectedIds.Clear();
        _canvasControl.CapturePointer(e.Pointer);
    }

    private void OnCanvasPointerMoved(object sender, PointerRoutedEventArgs e)
    {
        var pos = e.GetCurrentPoint(_canvasControl).Position;
        switch (_interaction)
        {
            case ViewportInteraction.Panning:
                var dx = (float)((pos.X - _panAnchor.X) / Camera.Zoom);
                var dy = (float)((pos.Y - _panAnchor.Y) / Camera.Zoom);
                Camera = new SpatialCamera(
                    _panCameraAnchor.X + dx,
                    _panCameraAnchor.Y + dy,
                    Camera.Zoom);
                CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
                _canvasControl.Invalidate();
                break;

            case ViewportInteraction.Selecting:
                _marqueeEndWorld = ScreenToWorld(pos);
                ComputeMarqueeSelection();
                _canvasControl.Invalidate();
                break;
        }
    }

    private void OnCanvasPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        _canvasControl.ReleasePointerCapture(e.Pointer);
        switch (_interaction)
        {
            case ViewportInteraction.Panning:
                _interaction = ViewportInteraction.Idle;
                break;

            case ViewportInteraction.Selecting:
                ComputeMarqueeSelection();
                SelectedItemIds = new HashSet<string>(_marqueeSelectedIds);
                SelectionChanged?.Invoke(this, new SelectionChangedEventArgs
                {
                    SelectedIds = _marqueeSelectedIds.ToArray(),
                });
                _interaction = ViewportInteraction.Idle;
                _canvasControl.Invalidate();
                break;
        }
    }

    private void OnCanvasPointerWheelChanged(object sender, PointerRoutedEventArgs e)
    {
        var point = e.GetCurrentPoint(_canvasControl);
        var delta = point.Properties.MouseWheelDelta;
        ZoomAtPoint(-delta, point.Position);
    }

    // ---- Keyboard ------------------------------------------------------------

    private void OnKeyDownHandler(object sender, KeyRoutedEventArgs e)
    {
        var ctrl = InputKeyboardSource.GetKeyStateForCurrentThread(VirtualKey.Control)
            .HasFlag(Windows.UI.Core.CoreVirtualKeyStates.Down);

        switch (e.Key)
        {
            case VirtualKey.Escape:
                if (_interaction == ViewportInteraction.ContextMenu)
                {
                    _interaction = ViewportInteraction.Idle;
                    _canvasControl.Invalidate();
                }
                break;

            case VirtualKey.Delete:
                DeleteRequested?.Invoke(this, EventArgs.Empty);
                break;

            case VirtualKey.A when ctrl:
                SelectedItemIds = new HashSet<string>(Items.Select(i => i.Id));
                SelectionChanged?.Invoke(this, new SelectionChangedEventArgs
                {
                    SelectedIds = Items.Select(i => i.Id).ToArray(),
                });
                _canvasControl.Invalidate();
                e.Handled = true;
                break;

            case VirtualKey.Add when ctrl:
            case VirtualKey.Number0 + 13 when ctrl: // '='
                ZoomAtPoint(-100, new Point(ActualWidth / 2, ActualHeight / 2));
                e.Handled = true;
                break;

            case VirtualKey.Subtract when ctrl:
                ZoomAtPoint(100, new Point(ActualWidth / 2, ActualHeight / 2));
                e.Handled = true;
                break;

            case VirtualKey.Number0 when ctrl:
                Camera = Camera with { Zoom = 1f };
                CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
                _canvasControl.Invalidate();
                e.Handled = true;
                break;

            case VirtualKey.Up:
                Camera = Camera with { Y = Camera.Y + 10f / Camera.Zoom };
                CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
                _canvasControl.Invalidate();
                break;
            case VirtualKey.Down:
                Camera = Camera with { Y = Camera.Y - 10f / Camera.Zoom };
                CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
                _canvasControl.Invalidate();
                break;
            case VirtualKey.Left:
                Camera = Camera with { X = Camera.X + 10f / Camera.Zoom };
                CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
                _canvasControl.Invalidate();
                break;
            case VirtualKey.Right:
                Camera = Camera with { X = Camera.X - 10f / Camera.Zoom };
                CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
                _canvasControl.Invalidate();
                break;
        }
    }

    // ---- Drawing (Win2D) -----------------------------------------------------

    private void OnDraw(CanvasControl sender, CanvasDrawEventArgs args)
    {
        var ds = args.DrawingSession;
        var vpWidth = (float)ActualWidth;
        var vpHeight = (float)ActualHeight;

        // Background
        ds.Clear(BackgroundFill);

        // Apply camera transform
        var transform = Matrix3x2.CreateScale(Camera.Zoom)
            * Matrix3x2.CreateTranslation(Camera.X * Camera.Zoom, Camera.Y * Camera.Zoom);
        ds.Transform = transform;

        // --- Grid layer ---
        if (GridVisible && GridStyle != "none")
        {
            float gs = GridSize;
            float visLeft = -Camera.X;
            float visTop = -Camera.Y;
            float visWidth = vpWidth / Camera.Zoom;
            float visHeight = vpHeight / Camera.Zoom;

            var gridColor = Color.FromArgb(80, 180, 180, 180);

            if (GridStyle == "dots")
            {
                for (float gx = MathF.Floor(visLeft / gs) * gs; gx <= visLeft + visWidth; gx += gs)
                {
                    for (float gy = MathF.Floor(visTop / gs) * gs; gy <= visTop + visHeight; gy += gs)
                    {
                        ds.FillCircle(gx, gy, 0.8f, gridColor);
                    }
                }
            }
            else // "lines"
            {
                for (float gx = MathF.Floor(visLeft / gs) * gs; gx <= visLeft + visWidth; gx += gs)
                {
                    ds.DrawLine(gx, visTop, gx, visTop + visHeight, gridColor, 0.5f);
                }
                for (float gy = MathF.Floor(visTop / gs) * gs; gy <= visTop + visHeight; gy += gs)
                {
                    ds.DrawLine(visLeft, gy, visLeft + visWidth, gy, gridColor, 0.5f);
                }
            }
        }

        // --- Connector layer ---
        var itemMap = Items.ToDictionary(i => i.Id);
        foreach (var conn in Connectors)
        {
            if (!itemMap.TryGetValue(conn.SourceId, out var src) ||
                !itemMap.TryGetValue(conn.TargetId, out var tgt))
                continue;

            var sx = src.X + src.Width / 2;
            var sy = src.Y + src.Height / 2;
            var tx = tgt.X + tgt.Width / 2;
            var ty = tgt.Y + tgt.Height / 2;
            var mx = (sx + tx) / 2;

            var connColor = Color.FromArgb(160, 148, 163, 184);
            using var pathBuilder = new CanvasPathBuilder(sender);
            pathBuilder.BeginFigure(sx, sy);
            pathBuilder.AddCubicBezier(
                new Vector2(mx, sy),
                new Vector2(mx, ty),
                new Vector2(tx, ty));
            pathBuilder.EndFigure(CanvasFigureLoop.Open);

            using var geo = CanvasGeometry.CreatePath(pathBuilder);
            var style = new CanvasStrokeStyle();
            if (conn.LineStyle == "dashed")
            {
                style.DashStyle = CanvasDashStyle.Dash;
            }
            ds.DrawGeometry(geo, connColor, 2f / Camera.Zoom, style);
        }

        // --- Item layer ---
        foreach (var item in VisibleItems())
        {
            bool isSelected = SelectedItemIds.Contains(item.Id);
            var rect = new Rect(item.X, item.Y, item.Width, item.Height);

            // Background
            ds.FillRoundedRectangle(rect, 4, 4, Colors.White);

            // Border
            var borderColor = isSelected
                ? Color.FromArgb(255, 59, 130, 246) // blue-500
                : Color.FromArgb(255, 209, 213, 219); // gray-300
            ds.DrawRoundedRectangle(rect, 4, 4, borderColor, isSelected ? 2f : 1f);

            // Type label
            ds.DrawText(item.Type,
                new Vector2(item.X + item.Width / 2, item.Y + item.Height / 2),
                Color.FromArgb(255, 107, 114, 128), // gray-500
                new Microsoft.Graphics.Canvas.Text.CanvasTextFormat
                {
                    FontSize = 11,
                    HorizontalAlignment = Microsoft.Graphics.Canvas.Text.CanvasHorizontalTextAlignment.Center,
                    VerticalAlignment = Microsoft.Graphics.Canvas.Text.CanvasVerticalTextAlignment.Center,
                });
        }

        // Reset transform for screen-space overlays
        ds.Transform = Matrix3x2.Identity;

        // --- Selection marquee ---
        if (_interaction == ViewportInteraction.Selecting)
        {
            var s = WorldToScreen(_marqueeStartWorld);
            var e = WorldToScreen(_marqueeEndWorld);
            var mRect = new Rect(
                Math.Min(s.X, e.X), Math.Min(s.Y, e.Y),
                Math.Abs(e.X - s.X), Math.Abs(e.Y - s.Y));

            ds.FillRectangle(mRect, Color.FromArgb(20, 59, 130, 246));
            ds.DrawRectangle(mRect, Color.FromArgb(255, 59, 130, 246), 1);
        }
    }

    private static void OnVisualPropertyChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is SpatialCanvasViewport viewport)
            viewport._canvasControl.Invalidate();
    }

    // ---- Public API ----------------------------------------------------------

    public void Invalidate() => _canvasControl.Invalidate();

    public void ZoomToFit()
    {
        if (Items.Count == 0) return;
        var minX = Items.Min(i => i.X);
        var minY = Items.Min(i => i.Y);
        var maxX = Items.Max(i => i.X + i.Width);
        var maxY = Items.Max(i => i.Y + i.Height);
        var padded = new Rect(minX - 40, minY - 40, maxX - minX + 80, maxY - minY + 80);
        var scaleX = (float)(ActualWidth / padded.Width);
        var scaleY = (float)(ActualHeight / padded.Height);
        var fitZoom = Math.Clamp(Math.Min(scaleX, scaleY), ZoomMin, ZoomMax);
        Camera = new SpatialCamera(
            (float)(-padded.X + (ActualWidth / fitZoom - padded.Width) / 2),
            (float)(-padded.Y + (ActualHeight / fitZoom - padded.Height) / 2),
            fitZoom);
        CameraChanged?.Invoke(this, new CameraChangedEventArgs { Camera = Camera });
        _canvasControl.Invalidate();
    }

    public void CloseContextMenu()
    {
        _interaction = ViewportInteraction.Idle;
        _canvasControl.Invalidate();
    }
}
