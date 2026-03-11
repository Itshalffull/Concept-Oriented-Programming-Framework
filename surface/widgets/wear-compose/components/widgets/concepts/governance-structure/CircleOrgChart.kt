package com.clef.surface.widgets.concepts.governancestructure

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class CircleOrgChartState { Idle, CircleSelected }

sealed class CircleOrgChartEvent {
    data class SelectCircle(val circleId: String) : CircleOrgChartEvent()
    object Deselect : CircleOrgChartEvent()
}

fun circleOrgChartReduce(
    state: CircleOrgChartState,
    event: CircleOrgChartEvent
): CircleOrgChartState = when (state) {
    CircleOrgChartState.Idle -> when (event) {
        is CircleOrgChartEvent.SelectCircle -> CircleOrgChartState.CircleSelected
        else -> state
    }
    CircleOrgChartState.CircleSelected -> when (event) {
        is CircleOrgChartEvent.Deselect -> CircleOrgChartState.Idle
        is CircleOrgChartEvent.SelectCircle -> CircleOrgChartState.CircleSelected
    }
}

// --- Public types ---

data class CircleMember(
    val id: String,
    val name: String,
    val role: String? = null
)

data class Circle(
    val id: String,
    val name: String,
    val purpose: String? = null,
    val members: List<CircleMember> = emptyList(),
    val parentId: String? = null,
    val children: List<Circle> = emptyList()
)

/** Flatten circle hierarchy into indented list. */
private fun flattenCircles(circles: List<Circle>, depth: Int = 0): List<Pair<Int, Circle>> {
    val result = mutableListOf<Pair<Int, Circle>>()
    for (circle in circles) {
        result.add(depth to circle)
        result.addAll(flattenCircles(circle.children, depth + 1))
    }
    return result
}

@Composable
fun CircleOrgChart(
    circles: List<Circle>,
    modifier: Modifier = Modifier,
    onCircleSelect: (Circle) -> Unit = {}
) {
    var state by remember { mutableStateOf(CircleOrgChartState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val flatList = remember(circles) { flattenCircles(circles) }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Organization chart" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Circles (${flatList.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(flatList) { (depth, circle) ->
            val isSelected = selectedId == circle.id
            val memberCount = circle.members.size

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else circle.id
                    selectedId = nextId
                    state = circleOrgChartReduce(
                        state,
                        if (nextId != null) CircleOrgChartEvent.SelectCircle(nextId)
                        else CircleOrgChartEvent.Deselect
                    )
                    onCircleSelect(circle)
                },
                label = {
                    Text(
                        text = "\u25CB ${circle.name}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            circle.purpose?.let {
                                Text(it, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall)
                            }
                            if (memberCount > 0) {
                                Text("$memberCount members", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                } else {
                    { Text("$memberCount members", style = MaterialTheme.typography.labelSmall) }
                },
                modifier = Modifier.padding(start = (depth * 12).dp)
            )
        }
    }
}
