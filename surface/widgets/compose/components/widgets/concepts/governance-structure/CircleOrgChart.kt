package com.clef.surface.widgets.concepts.governancestructure

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class CircleOrgChartState { Idle, CircleSelected }

sealed class CircleOrgChartEvent {
    data class SelectCircle(val id: String) : CircleOrgChartEvent()
    object Deselect : CircleOrgChartEvent()
}

fun circleOrgChartReduce(state: CircleOrgChartState, event: CircleOrgChartEvent): CircleOrgChartState = when (state) {
    CircleOrgChartState.Idle -> when (event) {
        is CircleOrgChartEvent.SelectCircle -> CircleOrgChartState.CircleSelected
        else -> state
    }
    CircleOrgChartState.CircleSelected -> when (event) {
        is CircleOrgChartEvent.Deselect -> CircleOrgChartState.Idle
        is CircleOrgChartEvent.SelectCircle -> CircleOrgChartState.CircleSelected
        else -> state
    }
}

// --- Types ---

data class CircleMember(val name: String, val role: String? = null)

data class Circle(
    val id: String,
    val name: String,
    val members: List<CircleMember> = emptyList(),
    val policies: List<String> = emptyList(),
    val jurisdiction: String? = null,
    val children: List<Circle> = emptyList()
)

// --- Helpers ---

private fun flattenCircles(circles: List<Circle>, expandedIds: Set<String>, depth: Int = 0): List<Pair<Circle, Int>> {
    val result = mutableListOf<Pair<Circle, Int>>()
    for (circle in circles) {
        result.add(circle to depth)
        if (circle.id in expandedIds && circle.children.isNotEmpty()) {
            result.addAll(flattenCircles(circle.children, expandedIds, depth + 1))
        }
    }
    return result
}

private fun findCircle(circles: List<Circle>, id: String): Circle? {
    for (circle in circles) {
        if (circle.id == id) return circle
        val found = findCircle(circle.children, id)
        if (found != null) return found
    }
    return null
}

@Composable
fun CircleOrgChart(
    circles: List<Circle>,
    modifier: Modifier = Modifier,
    selectedId: String? = null,
    onSelectCircle: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(CircleOrgChartState.Idle) }
    var internalSelectedId by remember { mutableStateOf<String?>(null) }
    var expandedIds by remember { mutableStateOf(emptySet<String>()) }
    val currentSelectedId = selectedId ?: internalSelectedId
    val flatList = remember(circles, expandedIds) { flattenCircles(circles, expandedIds) }
    val selectedCircle = remember(currentSelectedId, circles) { currentSelectedId?.let { findCircle(circles, it) } }

    fun handleSelect(id: String) {
        val nextId = if (id == currentSelectedId) null else id
        internalSelectedId = nextId
        onSelectCircle(nextId)
        state = if (nextId != null) CircleOrgChartState.CircleSelected else CircleOrgChartState.Idle
    }

    Column(modifier = modifier.semantics { contentDescription = "Organization chart" }) {
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(flatList, key = { it.first.id }) { (circle, depth) ->
                val isSelected = circle.id == currentSelectedId
                val hasChildren = circle.children.isNotEmpty()
                val isExpanded = circle.id in expandedIds

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { handleSelect(circle.id) }
                        .padding(start = (depth * 20).dp, end = 8.dp, top = 4.dp, bottom = 4.dp)
                        .then(
                            if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f))
                            else Modifier
                        )
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Expand/collapse
                        if (hasChildren) {
                            TextButton(
                                onClick = {
                                    expandedIds = if (isExpanded) expandedIds - circle.id else expandedIds + circle.id
                                },
                                contentPadding = PaddingValues(0.dp),
                                modifier = Modifier.size(24.dp)
                            ) { Text(if (isExpanded) "\u25BC" else "\u25B6", fontSize = 10.sp) }
                        } else {
                            Spacer(Modifier.size(24.dp))
                        }

                        Text(circle.name, fontWeight = FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text("${circle.members.size} members", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    // Member avatars (truncated)
                    if (circle.members.isNotEmpty()) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy((-4).dp),
                            modifier = Modifier.padding(start = 24.dp, top = 2.dp)
                        ) {
                            val shown = circle.members.take(5)
                            shown.forEach { member ->
                                Box(
                                    contentAlignment = Alignment.Center,
                                    modifier = Modifier.size(22.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant)
                                ) {
                                    Text(member.name.first().uppercase(), fontSize = 10.sp)
                                }
                            }
                            if (circle.members.size > 5) {
                                Text("+${circle.members.size - 5}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }

                    // Policy badges
                    if (circle.policies.isNotEmpty()) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(start = 24.dp, top = 2.dp)
                        ) {
                            circle.policies.forEach { policy ->
                                AssistChip(onClick = {}, label = { Text(policy, fontSize = 10.sp) })
                            }
                        }
                    }
                }
            }
        }

        // Detail panel
        selectedCircle?.let { circle ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Text(circle.name, fontWeight = FontWeight.Bold)
                circle.jurisdiction?.let { Text("Jurisdiction: $it", fontSize = 13.sp) }
                Text("Members: ${circle.members.size}", fontSize = 13.sp)
                circle.members.forEach { member ->
                    Text("  ${member.name}${member.role?.let { " ($it)" } ?: ""}", fontSize = 12.sp)
                }
                if (circle.policies.isNotEmpty()) {
                    Text("Policies: ${circle.policies.joinToString(", ")}", fontSize = 13.sp)
                }
            }
        }
    }
}
