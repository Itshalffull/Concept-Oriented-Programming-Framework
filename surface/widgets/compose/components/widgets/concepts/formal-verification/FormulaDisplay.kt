package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class FormulaDisplayState { Idle, Copied, Rendering }

sealed class FormulaDisplayEvent {
    object Copy : FormulaDisplayEvent()
    object RenderLatex : FormulaDisplayEvent()
    object Timeout : FormulaDisplayEvent()
    object RenderComplete : FormulaDisplayEvent()
}

fun formulaDisplayReduce(state: FormulaDisplayState, event: FormulaDisplayEvent): FormulaDisplayState = when (state) {
    FormulaDisplayState.Idle -> when (event) {
        is FormulaDisplayEvent.Copy -> FormulaDisplayState.Copied
        is FormulaDisplayEvent.RenderLatex -> FormulaDisplayState.Rendering
        else -> state
    }
    FormulaDisplayState.Copied -> when (event) {
        is FormulaDisplayEvent.Timeout -> FormulaDisplayState.Idle
        else -> state
    }
    FormulaDisplayState.Rendering -> when (event) {
        is FormulaDisplayEvent.RenderComplete -> FormulaDisplayState.Idle
        else -> state
    }
}

// --- Language definitions ---

enum class FormulaLanguage(val label: String) {
    Smtlib("SMT-LIB"),
    Tlaplus("TLA+"),
    Alloy("Alloy"),
    Lean("Lean"),
    Dafny("Dafny"),
    Cvl("CVL")
}

private val LANGUAGE_KEYWORDS: Map<FormulaLanguage, Set<String>> = mapOf(
    FormulaLanguage.Smtlib to setOf(
        "assert", "check-sat", "declare-fun", "declare-const", "define-fun",
        "forall", "exists", "let", "and", "or", "not", "ite", "true", "false",
        "Int", "Bool", "Real", "Array", "set-logic", "push", "pop"
    ),
    FormulaLanguage.Tlaplus to setOf(
        "VARIABLE", "VARIABLES", "CONSTANT", "CONSTANTS", "ASSUME", "THEOREM",
        "MODULE", "EXTENDS", "INSTANCE", "LOCAL", "LET", "IN", "IF", "THEN",
        "ELSE", "CHOOSE", "CASE", "OTHER", "ENABLED", "UNCHANGED", "EXCEPT",
        "DOMAIN", "SUBSET", "UNION", "TRUE", "FALSE"
    ),
    FormulaLanguage.Alloy to setOf(
        "sig", "abstract", "extends", "fact", "fun", "pred", "assert", "check",
        "run", "open", "module", "lone", "one", "some", "no", "all", "disj",
        "set", "seq", "let", "in", "and", "or", "not", "implies", "iff",
        "else", "none", "univ", "iden"
    ),
    FormulaLanguage.Lean to setOf(
        "theorem", "lemma", "def", "axiom", "constant", "variable", "example",
        "inductive", "structure", "class", "instance", "where", "let", "in",
        "have", "show", "assume", "match", "with", "if", "then", "else",
        "forall", "fun", "by", "sorry", "Prop", "Type", "Sort", "true", "false"
    ),
    FormulaLanguage.Dafny to setOf(
        "method", "function", "predicate", "lemma", "class", "module", "import",
        "requires", "ensures", "invariant", "decreases", "modifies", "reads",
        "var", "ghost", "forall", "exists", "if", "then", "else", "while",
        "assert", "assume", "return", "returns", "true", "false", "old", "fresh",
        "nat", "int", "bool", "seq", "set", "map", "multiset"
    ),
    FormulaLanguage.Cvl to setOf(
        "rule", "invariant", "ghost", "hook", "definition", "methods", "filtered",
        "require", "assert", "satisfy", "env", "calldataarg", "storage",
        "forall", "exists", "sinvoke", "invoke", "if", "else", "return",
        "true", "false", "uint256", "address", "bool", "bytes32", "mathint"
    )
)

// --- Token types ---

enum class TokenType { Keyword, Operator, Number, StringLit, Comment, Paren, Text }

data class FormulaToken(val type: TokenType, val value: String)

private val PAREN_CHARS = setOf('(', ')', '[', ']', '{', '}')

private fun tokenize(formula: String, language: FormulaLanguage): List<FormulaToken> {
    val keywords = LANGUAGE_KEYWORDS[language] ?: emptySet()
    val tokens = mutableListOf<FormulaToken>()
    var i = 0
    while (i < formula.length) {
        val c = formula[i]
        if (c.isWhitespace()) {
            val start = i
            while (i < formula.length && formula[i].isWhitespace()) i++
            tokens.add(FormulaToken(TokenType.Text, formula.substring(start, i)))
            continue
        }
        if (i + 1 < formula.length) {
            val pair = formula.substring(i, minOf(i + 2, formula.length))
            if (pair == "--" || pair == ";;" || pair == "//") {
                val end = formula.indexOf('\n', i).let { if (it == -1) formula.length else it }
                tokens.add(FormulaToken(TokenType.Comment, formula.substring(i, end)))
                i = end
                continue
            }
        }
        if (c == '"') {
            val end = formula.indexOf('"', i + 1).let { if (it == -1) formula.length else it + 1 }
            tokens.add(FormulaToken(TokenType.StringLit, formula.substring(i, end)))
            i = end
            continue
        }
        if (c in PAREN_CHARS) {
            tokens.add(FormulaToken(TokenType.Paren, c.toString()))
            i++
            continue
        }
        if (c.isDigit()) {
            val start = i
            while (i < formula.length && (formula[i].isDigit() || formula[i] == '.')) i++
            tokens.add(FormulaToken(TokenType.Number, formula.substring(start, i)))
            continue
        }
        if (c.isLetter() || c == '_' || c == '$') {
            val start = i
            while (i < formula.length && (formula[i].isLetterOrDigit() || formula[i] in setOf('_', '$', '\'', '-'))) i++
            val word = formula.substring(start, i)
            tokens.add(FormulaToken(if (word in keywords) TokenType.Keyword else TokenType.Text, word))
            continue
        }
        // Operators and fallback
        tokens.add(FormulaToken(TokenType.Text, c.toString()))
        i++
    }
    return tokens
}

// --- Style colors ---

private val keywordColor = Color(0xFF7C3AED)
private val operatorColor = Color(0xFFD97706)
private val numberColor = Color(0xFF0891B2)
private val stringColor = Color(0xFF16A34A)
private val commentColor = Color(0xFF9CA3AF)
private val parenColor = Color(0xFF6B7280)

private const val COLLAPSE_THRESHOLD = 200

@Composable
fun FormulaDisplay(
    formula: String,
    language: FormulaLanguage,
    modifier: Modifier = Modifier,
    scope: String? = null,
    renderLatex: Boolean = false,
    name: String? = null,
    description: String? = null
) {
    var state by remember { mutableStateOf(FormulaDisplayState.Idle) }
    var expanded by remember { mutableStateOf(false) }
    var descriptionOpen by remember { mutableStateOf(false) }
    val clipboardManager = LocalClipboardManager.current

    val isLong = formula.length > COLLAPSE_THRESHOLD
    val displayFormula = if (isLong && !expanded) formula.take(COLLAPSE_THRESHOLD) + "\u2026" else formula
    val tokens = remember(displayFormula, language) { tokenize(displayFormula, language) }

    // Auto-reset copied state
    LaunchedEffect(state) {
        if (state == FormulaDisplayState.Copied) {
            delay(2000)
            state = formulaDisplayReduce(state, FormulaDisplayEvent.Timeout)
        }
    }

    // LaTeX rendering simulation
    LaunchedEffect(renderLatex) {
        if (renderLatex && state == FormulaDisplayState.Idle) {
            state = formulaDisplayReduce(state, FormulaDisplayEvent.RenderLatex)
            delay(100)
            state = formulaDisplayReduce(state, FormulaDisplayEvent.RenderComplete)
        }
    }

    val ariaLabel = if (name != null) "Formula: $name in ${language.label}" else "Formula in ${language.label}"

    Column(modifier = modifier.semantics { contentDescription = ariaLabel }) {
        // Header: language badge, scope badge, copy button
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)
        ) {
            AssistChip(
                onClick = {},
                label = { Text(language.label, fontSize = 11.sp, fontFamily = FontFamily.Monospace) }
            )
            scope?.let {
                AssistChip(onClick = {}, label = { Text(it, fontSize = 11.sp) })
            }
            Spacer(Modifier.weight(1f))
            OutlinedButton(
                onClick = {
                    clipboardManager.setText(AnnotatedString(formula))
                    state = formulaDisplayReduce(state, FormulaDisplayEvent.Copy)
                },
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(if (state == FormulaDisplayState.Copied) "Copied!" else "Copy", fontSize = 12.sp)
            }
        }

        // Name
        name?.let {
            Text(it, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
        }

        // Syntax-highlighted formula
        val annotated = remember(tokens) {
            buildAnnotatedString {
                for (token in tokens) {
                    val style = when (token.type) {
                        TokenType.Keyword -> SpanStyle(fontWeight = FontWeight.Bold, color = keywordColor)
                        TokenType.Operator -> SpanStyle(color = operatorColor)
                        TokenType.Number -> SpanStyle(color = numberColor)
                        TokenType.StringLit -> SpanStyle(color = stringColor)
                        TokenType.Comment -> SpanStyle(color = commentColor, fontStyle = FontStyle.Italic)
                        TokenType.Paren -> SpanStyle(color = parenColor)
                        TokenType.Text -> SpanStyle()
                    }
                    withStyle(style) { append(token.value) }
                }
            }
        }

        Surface(
            shape = MaterialTheme.shapes.small,
            tonalElevation = 1.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = annotated,
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(8.dp)
            )
        }

        // Expand/collapse toggle for long formulas
        if (isLong) {
            TextButton(onClick = { expanded = !expanded }) {
                Text(if (expanded) "Show less" else "Show more", fontSize = 12.sp)
            }
        }

        // Collapsible description panel
        description?.let { desc ->
            TextButton(onClick = { descriptionOpen = !descriptionOpen }) {
                Text(if (descriptionOpen) "Hide description" else "Show description", fontSize = 12.sp)
            }
            if (descriptionOpen) {
                Text(desc, fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(vertical = 4.dp))
            }
        }
    }
}
