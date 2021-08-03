// prettier-ignore
/*NODE_JS_ONLY*/ const { AbstractTreeComponent, TreeComponentFrameworkDebuggerComponent } = require("jtree/products/TreeComponentFramework.node.js")

const { jtree } = require("jtree")
const { yodash } = require("../yodash")

const { TopBarComponent } = require("./TopBar.js")
const { SimEditorComponent } = require("./SimEditor.js")
const { HelpModalComponent } = require("./HelpModal.js")
const { BoardComponent } = require("./Board.js")
const { BottomBarComponent } = require("./BottomBar.js")
const { RightBarComponent } = require("./RightBar.js")
const { SIZES } = require("./Sizes.js")

// prettier-ignore
/*NODE_JS_ONLY*/ const simojiCompiler = jtree.compileGrammarFileAtPathAndReturnRootConstructor(   __dirname + "/../simoji.grammar")

class githubTriangleComponent extends AbstractTreeComponent {
  githubLink = `https://github.com/publicdomaincompany/simoji`
  toHakonCode() {
    return `.AbstractGithubTriangleComponent
 display block
 position absolute
 top 0
 right 0
 z-index 3`
  }
  toStumpCode() {
    return `a
 class AbstractGithubTriangleComponent
 href ${this.githubLink}
 target _blank
 img
  height 40px
  src github-fork.svg`
  }
}

class ErrorNode extends AbstractTreeComponent {
  _isErrorNodeType() {
    return true
  }
  toStumpCode() {
    console.error(`Warning: SimojiApp does not have a node type for "${this.getLine()}"`)
    return `span
 style display: none;`
  }
}

class SimojiApp extends AbstractTreeComponent {
  createParser() {
    return new jtree.TreeNode.Parser(ErrorNode, {
      TopBarComponent,
      githubTriangleComponent,
      SimEditorComponent,
      HelpModalComponent,
      BoardComponent,
      TreeComponentFrameworkDebuggerComponent,
      BottomBarComponent,
      RightBarComponent
    })
  }

  get agentMap() {
    if (!this._agentMap) {
      this.compiledCode = this.simojiProgram.compileAgentClassDeclarationsAndMap()
      //console.log(this.compiledCode)
      let evaled = {}
      try {
        evaled = eval(this.compiledCode)
      } catch {}
      this._agentMap = evaled
    }
    return this._agentMap
  }

  resetCommand() {
    const restart = this.isRunning
    this.loadNewSim(this.simojiProgram.toString())
    if (restart) this.startInterval()
  }

  makeGrid(simojiProgram, windowWidth, windowHeight) {
    const setSize = simojiProgram.get("size")
    const gridSize = Math.min(Math.max(setSize ? parseInt(setSize) : 20, 10), 200)

    const maxAvailableCols = Math.floor((windowWidth - SIZES.CHROME_WIDTH) / gridSize) - 1
    const maxAvailableRows = Math.floor((windowHeight - SIZES.CHROME_HEIGHT) / gridSize) - 1

    const minRequiredCols = 10
    const minRequiredRows = 10

    const setCols = simojiProgram.get("columns")
    const cols = Math.max(1, setCols ? parseInt(setCols) : Math.max(minRequiredCols, maxAvailableCols))

    const setRows = simojiProgram.get("rows")
    const rows = Math.max(1, setRows ? parseInt(setRows) : Math.max(minRequiredRows, maxAvailableRows))

    return { gridSize, cols, rows }
  }

  appendBoard() {
    const { simojiProgram, windowWidth, windowHeight } = this
    const { gridSize, cols, rows } = this.makeGrid(simojiProgram, windowWidth, windowHeight)
    const seed = simojiProgram.has("seed") ? parseInt(simojiProgram.get("seed")) : Date.now()
    this.randomNumberGenerator = yodash.getRandomNumberGenerator(seed)

    const compiledStartState = simojiProgram.compileSetup(rows, cols, this.randomNumberGenerator).trim()
    const styleNode = simojiProgram.getNode("style") ?? undefined
    this.appendLineAndChildren(
      `BoardComponent ${gridSize} ${rows} ${cols}`,
      `${compiledStartState.trim()}
GridComponent
${styleNode ? styleNode.toString().replace("style", "BoardStyleComponent") : ""}`.trim()
    )
  }

  get editor() {
    return this.getNode("SimEditorComponent")
  }

  loadExampleCommand(name) {
    const restart = this.isRunning
    const simCode = exampleSims.getNode(name).childrenToString()
    this.editor.setCodeMirrorValue(simCode)
    this.loadNewSim(simCode)
    if (restart) this.startInterval()
    location.hash = ""
  }

  get simCode() {
    return this.editor.simCode
  }

  loadNewSim(simCode) {
    this.stopInterval()
    delete this._agentMap
    delete this._simojiProgram
    delete this.compiledCode
    TreeNode._parsers.delete(BoardComponent) // clear parser

    this.board.unmountAndDestroy()
    this.appendBoard()
    this.renderAndGetRenderReport()
    this.updateLocalStorage(simCode)
  }

  updateLocalStorage(simCode) {
    localStorage.setItem("simoji", simCode)
    console.log("Local storage updated...")
  }

  dumpErrorsCommand() {
    const errs = this._simojiProgram.getAllErrors()
    console.log(new jtree.TreeNode(errs.map(err => err.toObject())).toFormattedTable(200))
  }

  get board() {
    return this.getNode("BoardComponent")
  }

  get simojiProgram() {
    if (!this._simojiProgram) this._simojiProgram = new simojiCompiler(this.simCode)
    return this._simojiProgram
  }

  startInterval() {
    this.interval = setInterval(() => {
      this.board.boardLoop()
    }, 1000 / this.ticksPerSecond)
  }

  stopInterval() {
    clearInterval(this.interval)
    delete this.interval
  }

  get isRunning() {
    return !!this.interval
  }

  async start() {
    const { willowBrowser } = this
    this._bindTreeComponentFrameworkCommandListenersOnBody()
    this.renderAndGetRenderReport(willowBrowser.getBodyStumpNode())

    const keyboardShortcuts = this._getKeyboardShortcuts()
    Object.keys(keyboardShortcuts).forEach(key => {
      willowBrowser.getMousetrap().bind(key, function(evt) {
        keyboardShortcuts[key]()
        // todo: handle the below when we need to
        if (evt.preventDefault) evt.preventDefault()
        return false
      })
    })

    this.willowBrowser.setResizeEndHandler(() => {
      console.log("resize")
      this.editor.setSize()
    })
  }

  interval = undefined

  get ticksPerSecond() {
    const setTime = this.simojiProgram.get("ticksPerSecond")
    return setTime ? parseInt(setTime) : 10
  }

  ensureRender() {
    if (this.interval) return this
    this.renderAndGetRenderReport()
  }

  toggleSelectCommand(object) {
    if (this.selection.includes(object)) {
      object.unselect()
      this.selection = this.selection.filter(node => node !== object)
    } else {
      this.selection.push(object)
      object.select()
    }

    this.ensureRender()
    return this
  }

  async downloadCsvCommand() {
    let extension = "csv"
    let type = "text/csv"
    let str = this.board.populationCsv
    const filename = "simoji"

    console.log(str)
    this.willowBrowser.downloadFile(str, filename + "." + extension, type)
  }

  async openReportInOhayoCommand() {
    this.willowBrowser.openUrl(this.ohayoLink)
  }

  get urlHash() {
    const tree = new jtree.TreeNode()
    tree.appendLineAndChildren("simoji", this.simojiProgram?.childrenToString() ?? "")
    return "#" + encodeURIComponent(tree.toString())
  }

  get report() {
    const report = this.simojiProgram.getNode("report")
    return report ? report.childrenToString() : "roughjs.line"
  }

  get ohayoLink() {
    const program = `data.inline
 ${this.report.replace(/\n/g, "\n ")}
 content
  ${this.board.populationCsv.replace(/\n/g, "\n  ")}`

    const link = this.willowBrowser.toPrettyDeepLink(program, {})
    const parts = link.split("?")
    return "https://ohayo.computer?filename=simoji.ohayo&" + parts[1]
  }

  updatePlayButtonComponentHack() {
    this.getNode("BottomBarComponent PlayButtonComponent")
      .setContent(this.interval)
      .renderAndGetRenderReport()
  }

  togglePlayCommand() {
    this.isRunning ? this.stopInterval() : this.startInterval()
    this.updatePlayButtonComponentHack()
  }

  pauseCommand() {
    if (this.isRunning) {
      this.stopInterval()
      this.updatePlayButtonComponentHack()
    }
  }

  changeAgentBrushCommand(agent) {
    if (agent === this._agentToInsert) {
      this._agentToInsert = undefined
      return this
    }
    this._agentToInsert = agent
    return this
  }

  get agentToInsert() {
    return this._agentToInsert
  }

  selection = []

  moveSelection(direction) {
    const { selection } = this
    if (!selection.length) return this
    selection.forEach(node => {
      node.angle = direction
      node._move()
    })

    this.ensureRender()
  }

  deleteSelectionCommand() {
    this.selection.forEach(node => node.unmountAndDestroy())
  }

  async toggleHelpCommand() {
    this.toggleAndRender("HelpModalComponent")
  }

  _getKeyboardShortcuts() {
    return {
      space: () => this.togglePlayCommand(),
      d: () => this.toggleTreeComponentFrameworkDebuggerCommand(),
      c: () => this.exportDataCommand(),
      o: () => this.openReportInOhayoCommand(),
      r: () => this.resetCommand(),
      up: () => this.moveSelection("North"),
      down: () => this.moveSelection("South"),
      right: () => this.moveSelection("East"),
      left: () => this.moveSelection("West"),
      "?": () => this.toggleHelpCommand(),
      backspace: () => this.deleteSelectionCommand()
    }
  }
}

SimojiApp.setupApp = (simojiCode, windowWidth = 1000, windowHeight = 1000) => {
  const startState = new jtree.TreeNode(`githubTriangleComponent
TopBarComponent
 LogoComponent
 ShareComponent
 ExamplesComponent
BottomBarComponent
 ResetButtonComponent
 PlayButtonComponent
 ReportButtonComponent
RightBarComponent
 AgentPaletteComponent
SimEditorComponent
 value
  ${simojiCode.replace(/\n/g, "\n  ")}`)

  const app = new SimojiApp(startState.toString())
  app.windowWidth = windowWidth
  app.windowHeight = windowHeight
  app.appendBoard()
  return app
}

module.exports = { SimojiApp }
