const { AbstractTreeComponent } = require("jtree/products/TreeComponentFramework.node.js")
const { yodash } = require("../yodash.js")
const { jtree } = require("jtree")
const { Keywords, Directions } = require("./Types.js")
const { WorldMap } = require("./WorldMap.js")

const SelectedClass = "selected"

class Agent extends jtree.TreeNode {
  get name() {
    return this._name ?? this.icon
  }

  angle = Directions.South

  getCommandBlocks(eventName) {
    return this.definitionWithBehaviors.findNodes(eventName)
  }

  get definitionWithBehaviors() {
    if (!this.behaviors.length) return this.board.simojiProgram.getNode(this.getWord(0))
    const behaviors = yodash.flatten(yodash.pick(this.board.simojiProgram, [this.getWord(0), ...this.behaviors]))
    return behaviors
  }

  skip(probability) {
    return probability !== undefined && this.board.randomNumberGenerator() > parseFloat(probability)
  }

  // if an element hasnt been removed. todo: cleanup
  get stillExists() {
    return !!this.element
  }

  _executeCommand(target, instruction) {
    const commandName = instruction.getWord(0)
    if (this[commandName]) this[commandName](target, instruction)
    // board commands
    else this.board[commandName](instruction)
  }

  _executeCommandBlocks(key) {
    this.getCommandBlocks(key).forEach(commandBlock => this._executeCommandBlock(commandBlock))
  }

  _executeCommandBlock(commandBlock) {
    if (this.skip(commandBlock.getWord(1))) return
    commandBlock.forEach(instruction => this._executeCommand(this, instruction))
  }

  onTick() {
    if (!this.stillExists) return
    if (this.tickStack) {
      this._executeCommandBlock(this.tickStack.shift())
      if (!this.tickStack.length) this.tickStack = undefined
    }

    this._executeCommandBlocks(Keywords.onTick)
    if (this.health === 0) this.onDeathCommand()
  }

  onDeathCommand() {
    this._executeCommandBlocks(Keywords.onDeath)
  }

  markDirty() {
    this.setWord(5, Date.now())
  }

  _replaceWith(newObject) {
    this.getParent().appendLine(`${newObject} ${this.positionHash}`)

    this.remove()
  }

  _move() {
    if (this.owner) return this

    const { angle } = this
    if (angle.includes(Directions.North)) this.moveNorth()
    else if (angle.includes(Directions.South)) this.moveSouth()
    if (angle.includes(Directions.East)) this.moveEast()
    else if (angle.includes(Directions.West)) this.moveWest()

    if (this.holding) {
      this.holding.forEach(node => {
        node.setPosition({ right: this.left, down: this.top })
      })
    }
  }

  moveSouth() {
    this.top++
  }

  moveNorth() {
    this.top--
  }

  moveWest() {
    this.left--
  }

  moveEast() {
    this.left++
  }

  get top() {
    return this.position.down
  }

  set top(value) {
    if (value > this.maxDown) value = this.maxDown
    if (value < 0) value = 0
    this.setPosition({
      down: value,
      right: this.left
    })
  }

  get root() {
    return this.getRootNode()
  }

  get board() {
    return this.getParent()
  }

  setPosition(newPosition) {
    if (!this.worldMap.canGoHere(this.agentSize, newPosition.right, newPosition.down))
      return this.bouncy ? this.bounce() : this
    const newLine = this.getLine()
      .split(" ")
      .map(part =>
        part.includes("⬇️") ? newPosition.down + "⬇️" : part.includes("➡️") ? newPosition.right + "➡️" : part
      )
      .join(" ")
    return this.setLine(newLine)
  }

  handleNeighbors() {
    if (!this.stillExists) return

    this.getCommandBlocks(Keywords.onNeighbors).forEach(neighborConditions => {
      if (this.skip(neighborConditions.getWord(1))) return

      const { neighorCount } = this

      neighborConditions.forEach(conditionAndCommandsBlock => {
        const [emoji, operator, count] = conditionAndCommandsBlock.getWords()
        const actual = neighorCount[emoji]
        if (!yodash.compare(actual ?? 0, operator, count)) return
        conditionAndCommandsBlock.forEach(command => this._executeCommand(this, command))

        if (this.getIndex() === -1) return {}
      })
    })
  }

  handleTouches() {
    if (!this.stillExists) return
    const { worldMap } = this
    this.getCommandBlocks(Keywords.onTouch).forEach(touchMap => {
      if (this.skip(touchMap.getWord(1))) return

      for (let target of worldMap.objectsTouching(this)) {
        const targetId = target.getWord(0)
        const commandBlock = touchMap.getNode(targetId)
        if (commandBlock) {
          commandBlock.forEach(command => this._executeCommand(target, command))
          if (this.getIndex() === -1) return
        }
      }
    })
  }

  handleCollisions(targetAgents) {
    if (!this.stillExists) return
    this.getCommandBlocks(Keywords.onHit).forEach(hitMap => {
      if (this.skip(hitMap.getWord(1))) return
      targetAgents.forEach(targetAgent => {
        const targetId = targetAgent.getWord(0)
        const commandBlock = hitMap.getNode(targetId)
        if (commandBlock) commandBlock.forEach(command => this._executeCommand(targetAgent, command))
      })
    })
  }

  get collidingAgents() {
    return this.worldMap.objectsCollidingWith(this.right, this.down, this.agentSize).filter(node => node !== this)
  }

  get neighorCount() {
    return this.worldMap.getNeighborCount(this)
  }

  get maxRight() {
    return this.board.cols - Math.floor(this.size / this.gridSize)
  }

  get maxDown() {
    return this.board.rows - Math.floor(this.size / this.gridSize)
  }

  set left(value) {
    if (value > this.maxRight) value = this.maxRight

    if (value < 0) value = 0
    this.setPosition({
      down: this.top,
      right: value
    })
  }

  get left() {
    return this.position.right
  }

  get position() {
    return this.worldMap.parsePosition(this.getWords())
  }

  get worldMap() {
    return this.board.worldMap
  }

  get positionHash() {
    return this.worldMap.makePositionHash(this.position)
  }

  get gridSize() {
    return this.getParent().gridSize
  }

  get selected() {
    return this.getWord(4) === SelectedClass
  }

  select() {
    this.setWord(4, SelectedClass)
  }

  unselect() {
    this.setWord(4, "")
  }

  _startHealth
  get startHealth() {
    if (this._startHealth === undefined) this._startHealth = this.health
    return this._startHealth
  }

  // DOM operations

  nuke() {
    this.element.remove()
    this.destroy()
  }

  get element() {
    return document.getElementById(`agent${this._getUid()}`)
  }

  _updateHtml() {
    this.element.setAttribute("style", this.inlineStyle)
    if (this.selected) this.element.classList.add(SelectedClass)
    else this.element.classList.remove(SelectedClass)
  }

  get agentSize() {
    return this.size ?? this.gridSize
  }

  get inlineStyle() {
    const { gridSize, health, agentSize } = this
    const opacity = health === undefined ? "" : `opacity:${this.health / this.startHealth};`
    return `top:${this.top * gridSize}px;left:${this.left *
      gridSize}px;font-size:${agentSize}px;line-height:${agentSize}px;${opacity};${this.style ?? ""}`
  }

  toElement() {
    const elem = document.createElement("div")
    elem.setAttribute("id", `agent${this._getUid()}`)
    elem.innerHTML = this.html ?? this.icon
    elem.classList.add("Agent")
    if (this.selected) elem.classList.add(SelectedClass)
    elem.setAttribute("style", this.inlineStyle)
    return elem
  }

  toggleSelectCommand() {
    const { root } = this
    root.selection.includes(this) ? this.unselectCommand() : this.selectCommand()

    root.ensureRender()
    return this
  }

  unselectCommand() {
    this.unselect()
    this.root.selection = this.root.selection.filter(node => node !== this)
  }

  selectCommand() {
    this.root.selection.push(this)
    this.select()
  }

  needsUpdate(lastRenderedTime = 0) {
    return this.getLineModifiedTime() - lastRenderedTime > 0
  }

  // Commands available to users:

  replaceWith(target, command) {
    return this._replaceWith(command.getWord(1))
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
    if (target.owner === this) return
    if (target.owner) target.owner._dropIt(target)

    target.owner = this
    if (!this.holding) this.holding = []
    this.holding.push(target)
  }

  _dropIt(target) {
    target.owner = undefined
    this.holding = this.holding.filter(item => item !== target)
  }

  dropIt(target) {
    this._dropIt(target)
  }

  narrate(subject, command) {
    this.root.log(`${this.getWord(0)} ${command.getContent()}`)
  }

  shoot() {
    if (!this.holding) return
    this.holding.forEach(agent => {
      this._dropIt(agent)
      this.kickIt(agent)
    })
  }
  bounce() {
    this.angle = yodash.flipAngle(this.angle)
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

  turnRandomly() {
    this.angle = yodash.getRandomAngle(this.board.randomNumberGenerator)
    return this
  }

  turnToward(target, instruction) {
    const targetId = instruction.getWord(1)
    const kind = this[targetId] ?? targetId // can define a custom target
    const targets = this.board.agentTypeMap.get(kind)
    if (targets) this.angle = yodash.getBestAngle(targets, this.position)
    return this
  }

  turnFrom(target, instruction) {
    const targetId = instruction.getWord(1)
    const kind = this[targetId] ?? targetId // can define a custom target
    const targets = this.board.agentTypeMap.get(kind)
    if (targets) this.angle = yodash.flipAngle(yodash.getBestAngle(targets, this.position))
    return this
  }

  remove() {
    this.nuke()
  }

  spawn(subject, command) {
    const position = command.getWordsFrom(2).length ? command.getWordsFrom(2).join(" ") : subject.positionHash
    this.board.appendLine(`${command.getWord(1)} ${position}`)
  }

  move() {
    if (this.selected) return
    return this._move()
  }

  moveToEmptySpot() {
    while (this.collidingAgents.length) {
      this.move()
    }
  }

  jitter() {
    this.turnRandomly()
    this.move()
  }

  learn(target, command) {
    this.behaviors.push(command.getWord(1))
  }

  unlearn(target, command) {
    const behaviorName = command.getWord(1)
    this.behaviors = this.behaviors.filter(name => name !== behaviorName)
  }
}

module.exports = { Agent }
