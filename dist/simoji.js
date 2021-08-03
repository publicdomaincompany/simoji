const yodash = {}


yodash.parseInts = (arr, start) => arr.map((item, index) => (index >= start ? parseInt(item) : item))

yodash.getRandomAngle = randomNumberGenerator => {
	const r1 = randomNumberGenerator()
	const r2 = randomNumberGenerator()
	if (r1 > 0.5) return r2 > 0.5 ? "North" : "South"
	return r2 > 0.5 ? "West" : "East"
}

yodash.flipAngle = angle => {
	let newAngle = ""
	if (angle.includes("North")) newAngle += "South"
	else if (angle.includes("South")) newAngle += "North"
	if (angle.includes("East")) newAngle += "West"
	else if (angle.includes("West")) newAngle += "East"
	return newAngle
}

yodash.getBestAngle = (targets, position) => {
	let closest = Infinity
	let target
	targets.forEach(candidate => {
		const pos = candidate.position
		const distance = math.distance([pos.down, pos.right], [position.down, position.right])
		if (distance < closest) {
			closest = distance
			target = candidate
		}
	})
	const heading = target.position
	return yodash.angle(position.down, position.right, heading.down, heading.right)
}

yodash.angle = (cx, cy, ex, ey) => {
	const dy = ey - cy
	const dx = ex - cx
	let theta = Math.atan2(dy, dx) // range (-PI, PI]
	theta *= 180 / Math.PI // rads to degs, range (-180, 180]
	//if (theta < 0) theta = 360 + theta; // range [0, 360)
	let angle = ""

	if (Math.abs(theta) > 90) angle += "North"
	else angle += "South"
	if (theta < 0) angle += "West"
	else angle += "East"
	return angle
}

yodash.getRandomLocation = (rows, cols, randomNumberGenerator) => {
	const maxRight = cols
	const maxBottom = rows
	const right = Math.round(randomNumberGenerator() * maxRight)
	const down = Math.round(randomNumberGenerator() * maxBottom)
	return { right, down }
}

yodash.getRandomLocationHash = (rows, cols, occupiedSpots, randomNumberGenerator) => {
	const { right, down } = yodash.getRandomLocation(rows, cols, randomNumberGenerator)
	const hash = yodash.makePositionHash({ right, down })
	if (occupiedSpots && occupiedSpots.has(hash))
		return yodash.getRandomLocationHash(rows, cols, occupiedSpots, randomNumberGenerator)
	return hash
}

yodash.fill = (rows, cols, occupiedSpots, emoji) => {
	const board = []
	while (rows >= 0) {
		let col = cols
		while (col >= 0) {
			const hash = yodash.makePositionHash({ right: col, down: rows })
			col--
			if (occupiedSpots.has(hash)) continue
			board.push(`${emoji} ${hash}`)
		}
		rows--
	}
	return board.join("\n")
}

yodash.applyCommandMap = (commandMap, targets, subject) => {
	targets.forEach(target => {
		const targetId = target.getWord(0)
		const instructions = commandMap.getNode(targetId)
		if (instructions) {
			instructions.forEach(instruction => {
				subject[instruction.getWord(0)](target, instruction)
			})
		}
	})
}

yodash.positionsAdjacentTo = position => {
	let { right, down } = position
	const positions = []
	down--
	positions.push({ down, right })
	right--
	positions.push({ down, right })
	right++
	right++
	positions.push({ down, right })
	down++
	positions.push({ down, right })
	right--
	right--
	positions.push({ down, right })
	down++
	positions.push({ down, right })
	right++
	positions.push({ down, right })
	right++
	positions.push({ down, right })
	return positions
}

yodash.makePositionHash = position => `${position.down + "⬇️ " + position.right + "➡️"}`

yodash.makeRectangle = (character = "🧱", width = 20, height = 20, startRight = 0, startDown = 0) => {
	if (width < 1 || height < 1) {
		return ""
	}
	const cells = []
	let row = 0
	while (row < height) {
		let col = 0
		while (col < width) {
			const isPerimeter = row === 0 || row === height - 1 || col === 0 || col === width - 1
			if (isPerimeter)
				cells.push(
					`${character} ${yodash.makePositionHash({
						down: startDown + row,
						right: startRight + col
					})}`
				)
			col++
		}
		row++
	}
	return cells.join("\n")
}

yodash.parsePosition = words => {
	return {
		down: parseInt(words.find(word => word.includes("⬇️")).slice(0, -1)),
		right: parseInt(words.find(word => word.includes("➡️")).slice(0, -1))
	}
}

yodash.updateOccupiedSpots = (board, occupiedSpots) => {
	new TreeNode(board).forEach(line => {
		occupiedSpots.add(yodash.makePositionHash(yodash.parsePosition(line.getWords())))
	})
}

yodash.getAllAvailableSpots = (rows, cols, occupiedSpots, rowStart = 0, colStart = 0) => {
	const availablePositions = []
	let down = rows
	while (down >= rowStart) {
		let right = cols
		while (right >= colStart) {
			const hash = yodash.makePositionHash({ right, down })
			if (!occupiedSpots.has(hash)) availablePositions.push({ right, down, hash })
			right--
		}
		down--
	}
	return availablePositions
}

yodash.insertRandomAgents = (randomNumberGenerator, amount, char, rows, cols, occupiedSpots) => {
	const availableSpots = yodash.getAllAvailableSpots(rows, cols, occupiedSpots)
	return sampleFrom(availableSpots, amount, randomNumberGenerator)
		.map(spot => {
			const { hash } = spot
			occupiedSpots.add(hash)
			return `${char} ${hash}`
		})
		.join("\n")
}

yodash.insertClusteredRandomAgents = (
	randomNumberGenerator,
	amount,
	char,
	rows,
	cols,
	occupiedSpots,
	originRow,
	originColumn
) => {
	const availableSpots = yodash.getAllAvailableSpots(rows, cols, occupiedSpots)
	const spots = sampleFrom(availableSpots, amount * 10, randomNumberGenerator)
	const origin = originColumn
		? { down: parseInt(originRow), right: parseInt(originColumn) }
		: yodash.getRandomLocation(rows, cols, randomNumberGenerator)
	const sortedByDistance = lodash.sortBy(spots, spot =>
		math.distance([origin.down, origin.right], [spot.down, spot.right])
	)

	return sortedByDistance
		.slice(0, amount)
		.map(spot => {
			const { hash } = spot
			occupiedSpots.add(hash)
			return `${char} ${hash}`
		})
		.join("\n")
}

yodash.getRandomNumberGenerator = seed => () => {
	const semiRand = Math.sin(seed++) * 10000
	return semiRand - Math.floor(semiRand)
}

const sampleFrom = (collection, howMany, randomNumberGenerator) =>
	shuffleArray(collection, randomNumberGenerator).slice(0, howMany)

const shuffleArray = (array, randomNumberGenerator) => {
	const clonedArr = array.slice()
	for (let index = clonedArr.length - 1; index > 0; index--) {
		const replacerIndex = Math.floor(randomNumberGenerator() * (index + 1))
		;[clonedArr[index], clonedArr[replacerIndex]] = [clonedArr[replacerIndex], clonedArr[index]]
	}
	return clonedArr
}

window.yodash = yodash




class Agent extends AbstractTreeComponent {
  get icon() {
    return this.agentDefinition.getWord(0)
  }

  get name() {
    return this._name ?? this.icon
  }

  get angle() {
    return this._angle ?? this.agentDefinition.get("angle") ?? "South"
  }

  set angle(value) {
    this._angle = value
  }

  get agentDefinition() {
    return this.root.simojiProgram.getNode(this.getWord(0))
  }

  replaceWith(target, command) {
    return this._replaceWith(command.getWord(1))
  }

  _replaceWith(newObject) {
    this.getParent().appendLine(`${newObject} ${this.positionHash}`)
    this.unmountAndDestroy()
  }

  javascript(target, command) {
    eval(command.childrenToString())
  }

  kickIt(target) {
    target.angle = this.angle
    target.tickStack = new jtree.TreeNode(`1
 move
 move
 move
2
 move
 move
3
 move
4
 move`)
    target._move()
  }

  pickItUp(target) {
    target.owner = this
    if (!this.holding) this.holding = []
    this.holding.push(target)
  }

  bounce() {
    this.angle = yodash.flipAngle(this.angle)
  }

  alert(target, command) {
    alert(command.getContent())
  }

  reset() {
    this.getRootNode().resetCommand()
  }

  log(target, command) {
    console.log(command.getContent())
  }

  decrease(target, command) {
    const property = command.getWord(1)
    if (target[property] === undefined) target[property] = 0
    target[property]--
  }

  increase(target, command) {
    const property = command.getWord(1)
    if (target[property] === undefined) target[property] = 0
    target[property]++
  }

  pause() {
    this.root.pauseCommand()
  }

  get touchMap() {
    return this.agentDefinition.getNode("onTouch")
  }

  handleCollisions(targets) {
    const commandMap = this.agentDefinition.getNode("onHit")
    if (!commandMap) return

    return yodash.applyCommandMap(commandMap, targets, this)
  }

  turnRandomly() {
    this.angle = yodash.getRandomAngle(this.root.randomNumberGenerator)
    return this
  }

  turnToward(target, instruction) {
    const targets = this.board.agentTypeMap.get(instruction.getWord(1))
    if (targets) this.angle = yodash.getBestAngle(targets, this.position)
    return this
  }

  turnFrom(target, instruction) {
    const targets = this.board.agentTypeMap.get(instruction.getWord(1))
    if (targets) this.angle = yodash.flipAngle(yodash.getBestAngle(targets, this.position))
    return this
  }

  executeCommands(key) {
    this.agentDefinition.findNodes(key).forEach(commands => this.executeCommandSequence(commands))
  }

  executeCommandSequence(commandSequence) {
    const probability = commandSequence.getWord(1)
    if (probability && this.root.randomNumberGenerator() > parseFloat(probability)) return
    commandSequence.forEach(instruction => {
      this[instruction.getWord(0)](this, instruction)
    })
  }

  onTick() {
    if (this.tickStack) {
      const next = this.tickStack.shift()
      this.executeCommandSequence(next)
      if (!this.tickStack.length) this.tickStack = undefined
    }

    this.executeCommands("onTick")
    if (this.health === 0) this.onDeathCommand()
  }

  remove() {
    this.unmountAndDestroy()
  }

  get neighorCount() {
    const { agentPositionMap } = this.board
    const neighborCounts = {}
    yodash.positionsAdjacentTo(this.position).forEach(pos => {
      const agents = agentPositionMap.get(yodash.makePositionHash(pos)) ?? []
      agents.forEach(agent => {
        if (!neighborCounts[agent.name]) neighborCounts[agent.name] = 0
        neighborCounts[agent.name]++
      })
    })
    return neighborCounts
  }

  onDeathCommand() {
    this.executeCommands("onDeath")
  }

  markDirty() {
    this.setWord(5, Date.now())
  }

  spawn(subject, command) {
    this.board.appendLine(`${command.getWord(1)} ${subject.positionHash}`)
  }

  move() {
    if (this.selected) return
    return this._move()
  }

  _move() {
    if (this.owner) return this

    const { angle } = this
    if (angle.includes("North")) this.moveNorthCommand()
    else if (angle.includes("South")) this.moveSouthCommand()
    if (angle.includes("East")) this.moveEastCommand()
    else if (angle.includes("West")) this.moveWestCommand()

    if (this.holding) {
      this.holding.forEach(node => {
        node.position = { right: this.left, down: this.top }
      })
    }
  }

  moveSouthCommand() {
    this.top++
  }

  moveNorthCommand() {
    this.top--
  }

  moveWestCommand() {
    this.left--
  }

  moveEastCommand() {
    this.left++
  }

  get top() {
    return this.position.down
  }

  set top(value) {
    if (value > this.maxDown) value = this.maxDown
    if (value < 0) value = 0
    this.position = {
      down: value,
      right: this.left
    }
  }

  get root() {
    return this.getRootNode()
  }

  set position(value) {
    if (this.board.isSolidAgent(value)) return this.bouncy ? this.bounce() : this
    const newLine = this.getLine()
      .split(" ")
      .map(part => (part.includes("⬇️") ? value.down + "⬇️" : part.includes("➡️") ? value.right + "➡️" : part))
      .join(" ")
    return this.setLine(newLine)
  }

  get board() {
    return this.getParent()
  }

  get maxRight() {
    return this.board.cols
  }

  get maxDown() {
    return this.board.rows
  }

  set left(value) {
    if (value > this.maxRight) value = this.maxRight

    if (value < 0) value = 0
    this.position = {
      down: this.top,
      right: value
    }
  }

  get left() {
    return this.position.right
  }

  get position() {
    return yodash.parsePosition(this.getWords())
  }

  get positionHash() {
    return yodash.makePositionHash(this.position)
  }

  get gridSize() {
    return this.getParent().gridSize
  }

  get selected() {
    return this.getWord(4) === "selected"
  }

  select() {
    this.setWord(4, "selected")
  }

  unselect() {
    this.setWord(4, "")
  }

  get startHealth() {
    return parseInt(this.agentDefinition.get("health"))
  }

  toStumpCode() {
    const { gridSize, health } = this
    const opacity = health === undefined ? "" : `opacity:${this.health / this.startHealth};`
    return `div ${this.html ?? this.icon}
 class Agent ${this.selected ? "selected" : ""}
 style top:${this.top * gridSize}px;left:${this.left *
      gridSize}px;font-size:${gridSize}px;line-height: ${gridSize}px;${opacity};${this.style ?? ""}`
  }
}

window.Agent = Agent




class AgentPaletteComponent extends AbstractTreeComponent {
  toStumpCode() {
    const root = this.getRootNode()
    const activeObject = root.agentToInsert
    const items = root.simojiProgram.agentTypes
      .map(item => item.getWord(0))
      .map(
        word => ` div ${word}
  class ${activeObject === word ? "ActiveObject" : ""}
  clickCommand changeAgentBrushCommand ${word}`
      )
      .join("\n")
    return `div
 class AgentPaletteComponent
${items}`
  }

  changeAgentBrushCommand(x) {
    this.getRootNode().changeAgentBrushCommand(x)
    this.setContent(Date.now()).renderAndGetRenderReport()
  }

  getDependencies() {
    return [this.getRootNode().board]
  }
}

window.AgentPaletteComponent = AgentPaletteComponent







class BoardComponent extends AbstractTreeComponent {
  createParser() {
    return new jtree.TreeNode.Parser(undefined, { ...this.root.agentMap, GridComponent, BoardStyleComponent })
  }

  get gridSize() {
    return parseInt(this.getWord(1))
  }

  get rows() {
    return parseInt(this.getWord(2))
  }

  get cols() {
    return parseInt(this.getWord(3))
  }

  get populationCsv() {
    const csv = new TreeNode(this._populationCounts).toCsv()
    // add 0's for missing values
    return csv
      .split("\n")
      .map(line =>
        line
          .split(",")
          .map(value => (value === "" ? "0" : value))
          .join(",")
      )
      .join("\n")
  }

  // todo: cleanup board vs agent commands
  alert(target, command) {
    alert(command.getContent())
  }

  pause() {
    this.root.pauseCommand()
  }

  get populationCount() {
    const counts = {}
    this.agents.forEach(node => {
      const id = node.name
      const count = (counts[id] ?? 0) + 1
      counts[id] = count
    })
    return counts
  }

  _populationCounts = []

  tick = 0
  boardLoop() {
    this.agents.forEach(node => node.onTick())

    this._agentPositionMap = this.makeAgentPositionMap()
    this.handleCollisions()
    this.handleTouches()

    this.executeBoardCommands("onTick")
    this.handleExtinctions()

    this.renderAndGetRenderReport()

    this.tick++
    this._populationCounts.push(this.populationCount)
  }

  get root() {
    return this.getParent()
  }

  spawn(subject, command) {
    this.appendLine(
      `${command.getWord(1)} ${yodash.getRandomLocationHash(
        this.rows,
        this.cols,
        undefined,
        this.root.randomNumberGenerator
      )}`
    )
  }

  handleExtinctions() {
    this.root.simojiProgram.findNodes("onExtinct").forEach(commands => {
      const emoji = commands.getWord(1)
      if (emoji && this.has(emoji)) return
      commands.forEach(instruction => {
        this[instruction.getWord(0)](this, instruction)
      })
    })
  }

  executeBoardCommands(key) {
    this.root.simojiProgram.findNodes(key).forEach(commands => {
      const probability = commands.getWord(1)
      if (probability && this.root.randomNumberGenerator() > parseFloat(probability)) return
      commands.forEach(instruction => {
        this[instruction.getWord(0)](this, instruction)
      })
    })
  }

  isSolidAgent(position) {
    if (!this._solidsSet) {
      this._solidsSet = new Set()
      this.getTopDownArray()
        .filter(node => node.solid)
        .forEach(item => {
          this._solidsSet.add(item.positionHash)
        })
    }
    const hash = yodash.makePositionHash(position)
    if (this._solidsSet.has(hash)) return true

    return false
  }

  get agents() {
    return this.getTopDownArray().filter(node => node instanceof Agent)
  }

  get agentPositionMap() {
    if (!this._agentPositionMap) this._agentPositionMap = this.makeAgentPositionMap()
    return this._agentPositionMap
  }

  makeAgentPositionMap() {
    const map = new Map()
    this.agents.forEach(node => {
      const { positionHash } = node
      if (!map.has(positionHash)) map.set(positionHash, [])
      map.get(positionHash).push(node)
    })
    return map
  }

  get agentTypeMap() {
    const map = new Map()
    this.agents.forEach(node => {
      const { name } = node
      if (!map.has(name)) map.set(name, [])
      map.get(name).push(node)
    })
    return map
  }

  agentAt(position) {
    const hits = this.agentPositionMap.get(position)
    return hits ? hits[0] : undefined
  }

  handleCollisions() {
    const { agentPositionMap } = this
    agentPositionMap.forEach(nodes => {
      if (nodes.length > 1) nodes.forEach(node => node.handleCollisions(nodes))
    })
  }

  handleTouches() {
    const agentPositionMap = this.agentPositionMap

    this.agents.forEach(subject => {
      const { touchMap } = subject
      if (!touchMap) return

      for (let pos of yodash.positionsAdjacentTo(subject.position)) {
        const hits = agentPositionMap.get(yodash.makePositionHash(pos)) ?? []
        for (let target of hits) {
          const targetId = target.getWord(0)
          const instructions = touchMap.getNode(targetId)
          if (instructions) {
            instructions.forEach(instruction => {
              subject[instruction.getWord(0)](target, instruction)
            })
            if (subject.getIndex() === -1) return
          }
        }
      }
    })
  }
}

class BoardStyleComponent extends AbstractTreeComponent {
  createParser() {
    return new jtree.TreeNode.Parser(TreeNode)
  }

  toStumpCode() {
    return `styleTag
 bern
  ${this.childrenToString().replace(/\n/g, "\n  ")}`
  }
}

window.BoardComponent = BoardComponent







class BottomBarComponent extends AbstractTreeComponent {
  createParser() {
    return new jtree.TreeNode.Parser(undefined, {
      PlayButtonComponent,
      ReportButtonComponent
    })
  }
}

window.BottomBarComponent = BottomBarComponent




class ExamplesComponent extends AbstractTreeComponent {
  toStumpCode() {
    const sims = exampleSims
      .getFirstWords()
      .map(
        item => ` a ${jtree.Utils.ucfirst(item)}
  href index.html#example%20${item}
  clickCommand loadExampleCommand ${item}`
      )
      .join("\n")
    return `div
 class ExamplesComponent
${sims}`
  }
}

window.ExamplesComponent = ExamplesComponent




class GridComponent extends AbstractTreeComponent {
  gridClickCommand(down, right) {
    const positionHash = down + " " + right
    const board = this.getParent()
    const root = board.getRootNode()
    const existingObject = board.agentAt(positionHash)
    if (existingObject) return root.toggleSelectCommand(existingObject)
    const { agentToInsert } = root

    if (!agentToInsert) return this

    //if (parent.findNodes(agentToInsert).length > MAX_ITEMS) return true

    board.prependLine(`${agentToInsert} ${positionHash}`)
    board.renderAndGetRenderReport()
  }

  makeBlock(down, right, gridSize) {
    return `\n div
  class block
  style width:${gridSize}px;height:${gridSize}px;top:${down * gridSize}px;left:${right * gridSize}px;
  clickCommand gridClickCommand ${yodash.makePositionHash({ right, down })}`
  }

  toStumpCode() {
    const { cols, rows, gridSize } = this.getParent()
    let blocks = ""
    let rs = rows
    while (rs >= 0) {
      let cs = cols
      while (cs >= 0) {
        blocks = this.makeBlock(rs, cs, gridSize) + blocks
        cs--
      }
      rs--
    }
    return (
      `div
 class GridComponent` + blocks
    )
  }
}

window.GridComponent = GridComponent





class AbstractModalTreeComponent extends AbstractTreeComponent {
  toHakonCode() {
    return `.modalBackground
 position fixed
 top 0
 left 0
 width 100%
 height 100%
 z-index 1000
 display flex
 padding-top 50px
 align-items baseline
 justify-content center
 box-sizing border-box
 background rgba(0,0,0,0.4)

.modalContent
 background white
 color black
 box-shadow 0px 0px 2px rgba(0,0,0,0.4)
 padding 20px
 position relative
 min-width 600px
 max-width 800px
 max-height 90%
 white-space nowrap
 text-overflow ellipsis
 overflow-x hidden
 overflow-y scroll

.modalClose
 position absolute
 top 10px
 right 10px
 cursor pointer`
  }

  toStumpCode() {
    return new jtree.TreeNode(`section
 clickCommand unmountAndDestroyCommand
 class modalBackground
 section
  clickCommand stopPropagationCommand
  class modalContent
  a X
   id closeModalX
   clickCommand unmountAndDestroyCommand
   class modalClose
  {modelStumpCode}`).templateToString({ modelStumpCode: this.getModalStumpCode() })
  }
}

class HelpModalComponent extends AbstractModalTreeComponent {
  getModalStumpCode() {
    return `iframe
 class helpIframe
 src cheatSheet.html`
  }
}

window.HelpModalComponent = HelpModalComponent




class PlayButtonComponent extends AbstractTreeComponent {
  get isStarted() {
    return this.getRootNode().isRunning
  }

  toStumpCode() {
    return `span ${this.isStarted ? "&#10074;&#10074;" : "▶︎"}
 class PlayButtonComponent
 clickCommand togglePlayCommand`
  }
}

window.PlayButtonComponent = PlayButtonComponent




class ReportButtonComponent extends AbstractTreeComponent {
  toStumpCode() {
    return `span Δ
 title Generate Report
 class ReportButtonComponent
 clickCommand openReportInOhayoCommand`
  }
}

window.ReportButtonComponent = ReportButtonComponent






class RightBarComponent extends AbstractTreeComponent {
	createParser() {
		return new jtree.TreeNode.Parser(undefined, {
			AgentPaletteComponent
		})
	}
}

window.RightBarComponent = RightBarComponent




class ShareComponent extends AbstractTreeComponent {
  toStumpCode() {
    return `div
 class ShareComponent
 input
  readonly
  title ${this.link}
  value ${this.link}`
  }

  getDependencies() {
    return [this.getRootNode().simojiProgram]
  }

  get link() {
    const url = new URL(location.href)
    url.hash = ""
    return url.toString() + this.getRootNode().urlHash
  }
}

window.ShareComponent = ShareComponent





// prettier-ignore



class SimEditorComponent extends AbstractTreeComponent {
  toStumpCode() {
    return `div
 class SimEditorComponent
 textarea
  id EditorTextarea
 div &nbsp;
  clickCommand dumpErrorsCommand
  id codeErrorsConsole`
  }

  createParser() {
    return new jtree.TreeNode.Parser(undefined, {
      value: jtree.TreeNode
    })
  }

  get codeMirrorValue() {
    return this.codeMirrorInstance.getValue()
  }

  codeWidgets = []

  _onCodeKeyUp() {
    const { willowBrowser } = this
    const code = this.codeMirrorValue
    if (this._code === code) return
    this._code = code
    const root = this.getRootNode()
    root.pauseCommand()
    // this._updateLocalStorage()

    this.program = new simojiCompiler(code)
    const errs = this.program.getAllErrors()

    const errMessage = errs.length ? `${errs.length} errors` : "&nbsp;"
    willowBrowser.setHtmlOfElementWithIdHack("codeErrorsConsole", errMessage)

    const cursor = this.codeMirrorInstance.getCursor()

    // todo: what if 2 errors?
    this.codeMirrorInstance.operation(() => {
      this.codeWidgets.forEach(widget => this.codeMirrorInstance.removeLineWidget(widget))
      this.codeWidgets.length = 0

      errs
        .filter(err => !err.isBlankLineError())
        .filter(err => !err.isCursorOnWord(cursor.line, cursor.ch))
        .slice(0, 1) // Only show 1 error at a time. Otherwise UX is not fun.
        .forEach(err => {
          const el = err.getCodeMirrorLineWidgetElement(() => {
            this.codeMirrorInstance.setValue(this.program.toString())
            this._onCodeKeyUp()
          })
          this.codeWidgets.push(
            this.codeMirrorInstance.addLineWidget(err.getLineNumber() - 1, el, { coverGutter: false, noHScroll: false })
          )
        })
      const info = this.codeMirrorInstance.getScrollInfo()
      const after = this.codeMirrorInstance.charCoords({ line: cursor.line + 1, ch: 0 }, "local").top
      if (info.top + info.clientHeight < after) this.codeMirrorInstance.scrollTo(null, after - info.clientHeight + 3)
    })

    root.loadNewSim(code)
  }

  get simCode() {
    return this.codeMirrorInstance ? this.codeMirrorValue : this.getNode("value").childrenToString()
  }

  async treeComponentDidMount() {
    this._initCodeMirror()
    this._updateCodeMirror()
    super.treeComponentDidMount()
  }

  async treeComponentDidUpdate() {
    this._updateCodeMirror()
    super.treeComponentDidUpdate()
  }

  setCodeMirrorValue(value) {
    this.codeMirrorInstance.setValue(value)
    this._code = value
  }

  _initCodeMirror() {
    this.codeMirrorInstance = new jtree.TreeNotationCodeMirrorMode(
      "custom",
      () => simojiCompiler,
      undefined,
      CodeMirror
    )
      .register()
      .fromTextAreaWithAutocomplete(document.getElementById("EditorTextarea"), {
        lineWrapping: false,
        lineNumbers: false
      })
    this.codeMirrorInstance.on("keyup", () => this._onCodeKeyUp())
    this.setSize()
  }

  setSize() {
    this.codeMirrorInstance.setSize(SIZES.EDITOR_WIDTH, window.innerHeight - SIZES.CHROME_HEIGHT)
  }

  _updateCodeMirror() {
    this.setCodeMirrorValue(this.getNode("value").childrenToString())
  }
}

window.SimEditorComponent = SimEditorComponent


// prettier-ignore












// prettier-ignore

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

window.SimojiApp = SimojiApp


const SIZES = {}

SIZES.BOARD_MARGIN = 20
SIZES.TOP_BAR_HEIGHT = 28
SIZES.BOTTOM_BAR_HEIGHT = 40
SIZES.CHROME_HEIGHT = SIZES.TOP_BAR_HEIGHT + SIZES.BOTTOM_BAR_HEIGHT + SIZES.BOARD_MARGIN

SIZES.EDITOR_WIDTH = 250
SIZES.RIGHT_BAR_WIDTH = 30
SIZES.CHROME_WIDTH = SIZES.EDITOR_WIDTH + SIZES.RIGHT_BAR_WIDTH + SIZES.BOARD_MARGIN

window.SIZES = SIZES







class TopBarComponent extends AbstractTreeComponent {
  createParser() {
    return new jtree.TreeNode.Parser(undefined, {
      LogoComponent,
      ShareComponent,
      ExamplesComponent
    })
  }
}

class LogoComponent extends AbstractTreeComponent {
  toStumpCode() {
    return `span Simoji
 class LogoComponent
 clickCommand toggleHelpCommand`
  }

  toggleHelpCommand() {
    this.getRootNode().toggleHelpCommand()
  }
}

window.TopBarComponent = TopBarComponent


const DEFAULT_SIM = "fire"



let exampleSims = new jtree.TreeNode()

class BrowserGlue extends AbstractTreeComponent {
  async fetchAndLoadSimCodeFromUrlCommand(url) {
    const { willowBrowser } = this
    const simCode = await willowBrowser.httpGetUrl(url)
    return simCode
  }

  getFromLocalStorage() {
    return localStorage.getItem("simoji")
  }

  async fetchSimCode() {
    const hash = location.hash.substr(1)
    const deepLink = new jtree.TreeNode(decodeURIComponent(hash))
    const example = deepLink.get("example")
    const fromUrl = deepLink.get("url")
    const simojiCode = deepLink.getNode("simoji")

    if (fromUrl) return this.fetchAndLoadSimCodeFromUrlCommand(fromUrl)
    if (example) return this.getExample(example)
    if (simojiCode) return simojiCode.childrenToString()

    const localStorageCode = this.getFromLocalStorage()
    if (localStorageCode) return localStorageCode

    return this.getExample(DEFAULT_SIM)
  }

  getExample(id) {
    return exampleSims.has(id) ? exampleSims.getNode(id).childrenToString() : `comment Example '${id}' not found.`
  }

  async fetchSimGrammarAndExamplesAndInit() {
    const grammar = await fetch("simoji.grammar")
    const grammarCode = await grammar.text()

    const result = await fetch("examples")
    return this.init(grammarCode, await result.text())
  }

  async init(grammarCode, theExamples) {
    window.simojiCompiler = new jtree.HandGrammarProgram(grammarCode).compileAndReturnRootConstructor()
    exampleSims = new jtree.TreeNode(theExamples)

    const simCode = await this.fetchSimCode()

    window.app = SimojiApp.setupApp(simCode, window.innerWidth, window.innerHeight)
    window.app.start()
    return window.app
  }
}

window.BrowserGlue = BrowserGlue
