import * as VS from 'vscode'
import * as Parser from 'tree-sitter'

const keywordsSpec = [
	"if",
	"do",
	"class",
	"struct",
	"virtual",
	"override",
	"final",
	"public",
	"private",
	"protected",
	"nullptr",
	"namespace",
	"default",
	"template",
	"typename",
	"const",
	"return",
	"sizeof",
	"auto",
	"for",
]

// Be sure to declare the language in package.json and include a minimalist grammar.
const languages: { [id: string]: { parser: Parser, color: ColorFunction } } = {
	'go': createParser('tree-sitter-go', colorGo),
	'typescript': createParser('tree-sitter-typescript', colorTypescript),
	'cpp': createParser('tree-sitter-cpp', colorCpp),
	'rust': createParser('tree-sitter-rust', colorRust),
}

// type ColorMapping = { Map<string,Parser.SyntaxNode[]> }

type ColorFunction = (x: Parser.SyntaxNode, editor: VS.TextEditor) => Map<string, Parser.SyntaxNode[]>

function colorGo(x: Parser.SyntaxNode, editor: VS.TextEditor) {

	var colorMapping = new Map<string, Parser.SyntaxNode[]>()

	var types: Parser.SyntaxNode[] = []
	var fields: Parser.SyntaxNode[] = []
	var functions: Parser.SyntaxNode[] = []
	function scan(x: Parser.SyntaxNode) {
		if (!isVisible(x, editor)) return
		if (x.type == 'identifier' && x.parent != null && x.parent.type == 'function_declaration') {
			functions.push(x)
		} else if (x.type == 'type_identifier') {
			types.push(x)
		} else if (x.type == 'field_identifier') {
			fields.push(x)
		}
		for (const child of x.children) {
			scan(child)
		}
	}
	scan(x)

	return colorMapping
}

function colorTypescript(x: Parser.SyntaxNode, editor: VS.TextEditor) {

	var colorMapping = new Map<string, Parser.SyntaxNode[]>()

	var types: Parser.SyntaxNode[] = []
	var fields: Parser.SyntaxNode[] = []
	var functions: Parser.SyntaxNode[] = []
	function scan(x: Parser.SyntaxNode) {
		if (!isVisible(x, editor)) return
		if (x.type == 'identifier' && x.parent != null && x.parent.type == 'function') {
			functions.push(x)
		} else if (x.type == 'type_identifier' || x.type == 'predefined_type') {
			types.push(x)
		} else if (x.type == 'property_identifier') {
			fields.push(x)
		}
		for (const child of x.children) {
			scan(child)
		}
	}
	scan(x)

	return colorMapping
}

function colorRust(x: Parser.SyntaxNode, editor: VS.TextEditor) {

	var colorMapping = new Map<string, Parser.SyntaxNode[]>()

	var types: Parser.SyntaxNode[] = []
	var fields: Parser.SyntaxNode[] = []
	var functions: Parser.SyntaxNode[] = []
	function scan(x: Parser.SyntaxNode) {
		if (!isVisible(x, editor)) return
		if (x.type == 'identifier' && x.parent != null && x.parent.type == 'function_item' && x.parent.parent != null && x.parent.parent.type == 'declaration_list') {
			fields.push(x)
		} else if (x.type == 'identifier' && x.parent != null && x.parent.type == 'function_item') {
			functions.push(x)
		} else if (x.type == 'identifier' && x.parent != null && x.parent.type == 'scoped_identifier' && x.parent.parent != null && x.parent.parent.type == 'function_declarator') {
			functions.push(x)
		} else if (x.type == 'type_identifier' || x.type == 'primitive_type') {
			types.push(x)
		} else if (x.type == 'field_identifier') {
			fields.push(x)
		}
		for (const child of x.children) {
			scan(child)
		}
	}
	scan(x)

	return colorMapping
}

function addToColorMap(map: Map<string, Parser.SyntaxNode[]>, id: string, node: Parser.SyntaxNode) {
	let syntaxNodes = map.get(id);
	if (!syntaxNodes) {
		syntaxNodes = map.set(id, []).get(id)!;
	}

	syntaxNodes.push(node)
}

// @ts-ignore
function colorCpp(x: Parser.SyntaxNode, editor: VS.TextEditor) {

	// var foo: { [accessParam: accessType]: containType } = { }

	var colorMapping = new Map<string, Parser.SyntaxNode[]>()

	function scan(x: Parser.SyntaxNode) {
		if (!isVisible(x, editor)) return
		if (x.type == 'identifier' ||
			x.type == 'field_identifier') {
			if (x.parent != null) {
				if (x.parent.type == 'preproc_def') {
					addToColorMap(colorMapping, "macros", x)
				} else if (x.parent.type == 'destructor_name' ||
					x.parent.type == 'function_declarator' ||
					x.parent.type == 'call_expression') {
					addToColorMap(colorMapping, 'functions', x)
				} else if (x.parent.type == 'scoped_identifier' ||
					x.parent.type == 'field_expression') {
					if (x.parent.parent != null) {
						if (x.parent.parent.type == 'function_declarator' ||
							x.parent.parent.type == 'template_function' ||
							x.parent.parent.type == 'call_expression') {
							if (x.parent.parent.parent != null) {
								addToColorMap(colorMapping, 'functions', x)
							}
						}
					}
				} else if (x.parent.type == 'enumerator') {
					addToColorMap(colorMapping, 'enums', x)
				} else if (x.parent.type == 'namespace_definition') {
					addToColorMap(colorMapping, 'types', x)
				}
			} else if (x.type == 'field_identifier') {
				addToColorMap(colorMapping, 'fields', x)
			}
		} else if (x.type == 'type_identifier' ||
			x.type == 'namespace_identifier') {
			addToColorMap(colorMapping, 'types', x)
		} else if (x.type == 'primitive_type') {
			addToColorMap(colorMapping, 'primitives', x)
		} else if (keywordsSpec.includes(x.type)) {
			addToColorMap(colorMapping, 'keywords', x)
		}
		for (const child of x.children) {
			scan(child)
		}
	}
	scan(x)

	return colorMapping
}

function isVisible(x: Parser.SyntaxNode, editor: VS.TextEditor) {
	for (const visible of editor.visibleRanges) {
		const overlap = x.startPosition.row <= visible.end.line + 1 && visible.start.line - 1 <= x.endPosition.row
		if (overlap) return true
	}
	return false
}

function createParser(module: string, color: ColorFunction): { parser: Parser, color: ColorFunction } {
	const lang = require(module)
	const parser = new Parser()
	parser.setLanguage(lang)
	return { parser, color }
}

// Called when the extension is first activated by user opening a file with the appropriate language
export function activate(context: VS.ExtensionContext) {
	console.log("Activating tree-sitter...")
	// Parse of all visible documents
	const trees: { [uri: string]: Parser.Tree } = {}
	function open(editor: VS.TextEditor) {
		const language = languages[editor.document.languageId]
		if (language == null) return
		const t = language.parser.parse(editor.document.getText()) // TODO don't use getText, use Parser.Input
		trees[editor.document.uri.toString()] = t
		colorUri(editor.document.uri)
	}
	function edit(edit: VS.TextDocumentChangeEvent) {
		const language = languages[edit.document.languageId]
		if (language == null) return
		updateTree(language.parser, edit)
		colorUri(edit.document.uri)
	}
	function updateTree(parser: Parser, edit: VS.TextDocumentChangeEvent) {
		if (edit.contentChanges.length == 0) return
		const old = trees[edit.document.uri.toString()]
		for (const e of edit.contentChanges) {
			const startIndex = e.rangeOffset
			const oldEndIndex = e.rangeOffset + e.rangeLength
			const newEndIndex = e.rangeOffset + e.text.length
			const startPos = edit.document.positionAt(startIndex)
			const oldEndPos = edit.document.positionAt(oldEndIndex)
			const newEndPos = edit.document.positionAt(newEndIndex)
			const startPosition = asPoint(startPos)
			const oldEndPosition = asPoint(oldEndPos)
			const newEndPosition = asPoint(newEndPos)
			const delta = { startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition }
			old.edit(delta)
		}
		const t = parser.parse(edit.document.getText(), old) // TODO don't use getText, use Parser.Input
		trees[edit.document.uri.toString()] = t
	}
	function asPoint(pos: VS.Position): Parser.Point {
		return { row: pos.line, column: pos.character }
	}
	function close(doc: VS.TextDocument) {
		if (doc.languageId == 'go') {
			delete trees[doc.uri.toString()]
		}
	}
	// Apply themeable colors
	const typeStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.type')
	})
	const fieldStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.field')
	})
	const functionStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.function')
	})
	const primitiveStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.primitive')
	})
	const macroStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.macro')
	})
	const enumStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.enum')
	})
	const keywordStyle = VS.window.createTextEditorDecorationType({
		color: new VS.ThemeColor('treeSitter.keyword')
	})
	function colorUri(uri: VS.Uri) {
		for (const editor of VS.window.visibleTextEditors) {
			if (editor.document.uri == uri) {
				colorEditor(editor)
			}
		}
	}
	function colorEditor(editor: VS.TextEditor) {
		const t = trees[editor.document.uri.toString()]
		if (t == null) return
		const language = languages[editor.document.languageId]
		if (language == null) return
		const colorMapping = language.color(t.rootNode, editor)

		if (editor.document.languageId == 'cpp') {
			if (colorMapping != null) {
				editor.setDecorations(typeStyle, colorMapping.has('types') ? colorMapping.get('types')!.map(range) : [])
				editor.setDecorations(fieldStyle, colorMapping.has('fields') ? colorMapping.get('fields')!.map(range) : [])
				editor.setDecorations(functionStyle, colorMapping.has('functions') ? colorMapping.get('functions')!.map(range) : [])
				editor.setDecorations(keywordStyle, colorMapping.has('keywords') ? colorMapping.get('keywords')!.map(range) : [])
				editor.setDecorations(macroStyle, colorMapping.has('macros') ? colorMapping.get('macros')!.map(range) : [])
				editor.setDecorations(enumStyle, colorMapping.has('enums') ? colorMapping.get('enums')!.map(range) : [])
				editor.setDecorations(primitiveStyle, colorMapping.has('primitives') ? colorMapping.get('primitives')!.map(range) : [])
			}
		} else {
			// if(types != null) editor.setDecorations(typeStyle, types.map(range))
			// if(fields != null) editor.setDecorations(fieldStyle, fields.map(range))
			// if(functions != null) editor.setDecorations(functionStyle, functions.map(range))
		}
		// console.log(t.rootNode.toString())
	}
	VS.window.visibleTextEditors.forEach(open)
	context.subscriptions.push(VS.window.onDidChangeVisibleTextEditors(editors => editors.forEach(open)))
	context.subscriptions.push(VS.workspace.onDidChangeTextDocument(edit))
	context.subscriptions.push(VS.workspace.onDidCloseTextDocument(close))
	context.subscriptions.push(VS.window.onDidChangeTextEditorVisibleRanges(change => colorEditor(change.textEditor)))
}

function range(x: Parser.SyntaxNode): VS.Range {
	return new VS.Range(x.startPosition.row, x.startPosition.column, x.endPosition.row, x.endPosition.column)
}

// this method is called when your extension is deactivated
export function deactivate() { }
