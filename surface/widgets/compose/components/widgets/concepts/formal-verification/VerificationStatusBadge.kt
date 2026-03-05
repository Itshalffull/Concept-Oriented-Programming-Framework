package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class VerificationStatusBadgeState { Idle, Hovered, Animating }

sealed class VerificationStatusBadgeEvent {
    object Hover : VerificationStatusBadgeEvent()
    object StatusChange : VerificationStatusBadgeEvent()
    object Leave : VerificationStatusBadgeEvent()
    object AnimationEnd : VerificationStatusBadgeEvent()
}

fun verificationStatusBadgeReduce(
    state: VerificationStatusBadgeState,
    event: VerificationStatusBadgeEvent
): VerificationStatusBadgeState = when (state) {
    VerificationStatusBadgeState.Idle -> when (event) {
        is VerificationStatusBadgeEvent.Hover -> VerificationStatusBadgeState.Hovered
        is VerificationStatusBadgeEvent.StatusChange -> VerificationStatusBadgeState.Animating
        else -> state
    }
    VerificationStatusBadgeState.Hovered -> when (event) {
        is VerificationStatusBadgeEvent.Leave -> VerificationStatusBadgeState.Idle
        else -> state
    }
    VerificationStatusBadgeState.Animating -> when (event) {
        is VerificationStatusBadgeEvent.AnimationEnd -> VerificationStatusBadgeState.Idle
        else -> state
    }
}

// --- Types ---

enum class VerificationStatus(val icon: String, val defaultLabel: String, val color: Color) {
    Proved("\u2713", "Proved", Color(0xFF22C55E)),
    Refuted("\u2717", "Refuted", Color(0xFFEF4444)),
    Unknown("?", "Unknown", Color(0xFF9CA3AF)),
    Timeout("\u23F0", "Timeout", Color(0xFFF97316)),
    Running("\u25CB", "Running", Color(0xFF3B82F6))
}

@Composable
fun VerificationStatusBadge(
    modifier: Modifier = Modifier,
    status: VerificationStatus = VerificationStatus.Unknown,
    label: String = status.defaultLabel,
    duration: Long? = null,
    solver: String? = null,
    size: String = "md"
) {
    var state by remember { mutableStateOf(VerificationStatusBadgeState.Idle) }
    var prevStatus by remember { mutableStateOf(status) }
    var showTooltip by remember { mutableStateOf(false) }

    // Trigger animation on status change
    LaunchedEffect(status) {
        if (prevStatus != status) {
            prevStatus = status
            state = verificationStatusBadgeReduce(state, VerificationStatusBadgeEvent.StatusChange)
        }
    }

    // Auto-end animation
    LaunchedEffect(state) {
        if (state == VerificationStatusBadgeState.Animating) {
            delay(200)
            state = verificationStatusBadgeReduce(state, VerificationStatusBadgeEvent.AnimationEnd)
        }
    }

    val animatedColor by animateColorAsState(
        targetValue = status.color,
        label = "status-color"
    )

    val fontSize = when (size) {
        "sm" -> 12.sp
        "lg" -> 16.sp
        else -> 14.sp
    }
    val iconSize = when (size) {
        "sm" -> 14.sp
        "lg" -> 20.sp
        else -> 16.sp
    }

    val hasTooltipContent = solver != null || duration != null
    val tooltipText = listOfNotNull(solver, duration?.let { "${it}ms" }).joinToString(" \u2014 ")

    val ariaLabel = "Verification status: $label"

    if (hasTooltipContent) {
        TooltipBox(
            positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
            tooltip = { PlainTooltip { Text(tooltipText) } },
            state = rememberTooltipState()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = modifier.semantics { contentDescription = ariaLabel }
            ) {
                Text(status.icon, fontSize = iconSize, color = animatedColor)
                Text(label, fontSize = fontSize, fontWeight = FontWeight.Medium, color = animatedColor)
            }
        }
    } else {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = modifier.semantics { contentDescription = ariaLabel }
        ) {
            Text(status.icon, fontSize = iconSize, color = animatedColor)
            Text(label, fontSize = fontSize, fontWeight = FontWeight.Medium, color = animatedColor)
        }
    }
}
