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
	"true",
	"false",
	"enum",
	'static',
	'constexpr'
]

var decoratorMap = new Map<string, VS.TextEditorDecorationType>()

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
	var colorMapping = new Map<string, Parser.SyntaxNode[]>()
	function scan(x: Parser.SyntaxNode) {
		if (!isVisible(x, editor)) 
			return
		
		if (x.type == 'identifier') 
		{
			const parent_type = x.parent != null ? x.parent.type : ''
			if (parent_type == 'preproc_def') 
			{
				addToColorMap(colorMapping, "macros", x)
			} 
			else if (parent_type == 'enumerator') 
			{
				addToColorMap(colorMapping, 'enums', x)
			} 
			else if (parent_type == 'namespace_definition') 
			{
				addToColorMap(colorMapping, 'types', x)
			}
			else if (parent_type == 'destructor_name' || parent_type == 'function_declarator' || parent_type == 'call_expression') 
			{
				addToColorMap(colorMapping, 'functions', x)
			} 
			else if (parent_type == 'scoped_identifier' ) 
			{
				const type = x.parent!.parent != null ? x.parent!.parent.type : ''
				if (type == 'function_declarator' || type == 'template_function') 
				{
					const type = x.parent!.parent!.parent != null ? x.parent!.parent!.parent.type : ''
					if(type == 'call_expression' || type == 'function_definition')
					{
						addToColorMap(colorMapping, 'functions', x)
					}
				} 
				else if ( type == 'call_expression')
				{
					addToColorMap(colorMapping, 'functions', x)
				}
			} 
			else
			{
				if(keywordsSpec.includes(x.text))
				{
					addToColorMap(colorMapping, 'keywords', x)
				}
				else
				{
					addToColorMap(colorMapping, 'fields', x)
				}
			}
		}
		else if(x.type == 'field_identifier') 
		{
			if(x.parent != null) 
			{
				if(x.parent.type == 'function_declarator')
				{
					addToColorMap(colorMapping, 'functions', x)
				} 
				else if (x.parent.type == 'field_expression')
				{
					const type = x.parent.parent != null ? x.parent.parent.type : ''
					if(type == 'call_expression')
					{
						addToColorMap(colorMapping, 'functions', x)
					}
					else
					{
						addToColorMap(colorMapping, 'fields', x)
					}
				}
				else
				{
					addToColorMap(colorMapping, 'fields', x)
				}
			}
		} 
		else if (x.type == 'type_identifier' ||	x.type == 'namespace_identifier') 
		{
			addToColorMap(colorMapping, 'types', x)
		} 
		else if (x.type == 'primitive_type') 
		{
			addToColorMap(colorMapping, 'primitives', x)
		}
		else if (keywordsSpec.includes(x.text)) 
		{
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

	function colorUri(uri: VS.Uri) {
		for (const editor of VS.window.visibleTextEditors) {
			if (editor.document.uri == uri) {
				colorEditor(editor)
			}
		}
	}

	function getNodeList(key: string, map: Map<string, Parser.SyntaxNode[]>) {
		let nodeList = map.get(key)
		if (!nodeList) return []
		return nodeList!.map(range)
	}

	function createDecorator(key: string) {
		const suffix = key.substr(0, key.length - 1)

		let decorator = decoratorMap.get(suffix)
		if(decorator == null)
			decorator = decoratorMap.set(suffix, VS.window.createTextEditorDecorationType({ color: new VS.ThemeColor('treeSitter.' + suffix) })).get(suffix)

		return decorator!
	}

	function colorEditor(editor: VS.TextEditor) {
		const t = trees[editor.document.uri.toString()]
		if (t == null) return
		const language = languages[editor.document.languageId]
		if (language == null) return
		const colorMapping = language.color(t.rootNode, editor)

		for (const [key] of colorMapping) {
			editor.setDecorations(createDecorator(key), getNodeList(key, colorMapping))
		}
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
