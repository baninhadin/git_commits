import * as fs from 'fs'
import * as child_process from 'child_process'
import { createCanvas } from 'canvas'

const HPattern: Array<Array<'dark' | 'light'>> = [
  ['dark', 'light', 'light', 'dark'],
  ['dark', 'light', 'light', 'dark'],
  ['dark', 'light', 'light', 'dark'],
  ['dark', 'dark', 'dark', 'dark'],
  ['dark', 'light', 'light', 'dark'],
  ['dark', 'light', 'light', 'dark'],
  ['dark', 'light', 'light', 'dark'],
]

const EPattern: Array<Array<'dark' | 'light'>> = [
  ['dark', 'dark', 'dark', 'dark'],
  ['dark', 'light', 'light', 'light'],
  ['dark', 'light', 'light', 'light'],
  ['dark', 'dark', 'dark', 'dark'],
  ['dark', 'light', 'light', 'light'],
  ['dark', 'light', 'light', 'light'],
  ['dark', 'dark', 'dark', 'dark'],
]

const startDate = new Date('2025-01-12')
const endDate = new Date('2025-12-27')

function randomCommits(type: 'dark' | 'light'): number {
  return type === 'dark'
    ? Math.floor(Math.random() * 6) + 23
    : Math.floor(Math.random() * 10) + 2
}

function simulateHeatmapData(
  pattern: Array<Array<'dark' | 'light'>>
): number[][] {
  const heatmapData: number[][] = []
  for (const row of pattern) {
    const rowData: number[] = []
    for (const cell of row) {
      rowData.push(randomCommits(cell))
    }
    heatmapData.push(rowData)
  }
  return heatmapData
}

function createHeatmap(data: number[][], filename: string): void {
  const cellSize = 50
  const width = data[0].length * cellSize
  const height = data.length * cellSize

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  const maxCommits = Math.max(...data.flat())

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const intensity = data[row][col] / maxCommits
      const colorValue = Math.floor(255 - intensity * 255)
      ctx.fillStyle = `rgb(${colorValue}, ${255}, ${colorValue})`
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }

  const out = fs.createWriteStream(filename)
  const stream = canvas.createPNGStream()
  stream.pipe(out)
  out.on('finish', () => console.log(`Heatmap saved to ${filename}`))
}

function getPatternForToday(): {
  pattern: 'H' | 'E'
  weekIndex: number
  dayIndex: number
} | null {
  const today = new Date()
  if (today < startDate || today > endDate) {
    return null
  }

  const dayDifference = Math.floor(
    (today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  )
  const weekIndex = Math.floor(dayDifference / 7) % 4
  const dayIndex = (today.getDay() - 1 + 7) % 7

  const pattern = Math.floor(dayDifference / (4 * 7)) % 2 === 0 ? 'H' : 'E'

  return { pattern, weekIndex, dayIndex }
}

function writeLog(entry: string): void {
  fs.writeFileSync('log.txt', entry + '\n')
}

function gitCommit(date: string, message: string): void {
  try {
    child_process.execSync('git add log.txt')
    child_process.execSync(`git commit -m "${message}" --date "${date}"`)
  } catch (error) {
    console.error('Git command failed:', error)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateCommitsForToday(): Promise<void> {
  const patternData = getPatternForToday()
  const today = new Date().toString()

  if (!patternData) {
    const skipMessage = `Skip today. at ${new Date()}`
    console.log(skipMessage)
    writeLog(skipMessage)
    gitCommit(today, skipMessage)
    return
  }

  console.log(`Pattern for ${today}: ${JSON.stringify(patternData)}`)

  const { pattern, weekIndex, dayIndex } = patternData

  const currentPattern = pattern === 'H' ? HPattern : EPattern
  const commitType = currentPattern[dayIndex][weekIndex]
  const commitCount = randomCommits(commitType)

  console.log(`Commits count for ${today}: ${commitCount}`)

  const dayDifference = Math.floor(
    (new Date(today).getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  )
  const dayNumber = dayDifference + 1

  for (let i = 1; i <= commitCount; i++) {
    let logEntry = `Day ${dayNumber}`
    if (i > 1) {
      logEntry += `. Part ${i}`
    }
    writeLog(logEntry)
    gitCommit(today, logEntry)

    await delay(5000)
  }
}

async function main(): Promise<void> {
  try {
    console.log('Script run at: ' + new Date())
    console.log('Generating heatmap for H pattern...')
    const HData = simulateHeatmapData(HPattern)
    createHeatmap(HData, 'HPatternHeatmap.png')

    console.log('Generating heatmap for E pattern...')
    const EData = simulateHeatmapData(EPattern)
    createHeatmap(EData, 'EPatternHeatmap.png')

    await generateCommitsForToday()
    console.log('Commits generated successfully for today.')

    child_process.execSync('git push')
    console.log('Changes pushed to GitHub successfully.')

    console.log('Script completed.')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    process.exit(0)
  }
}

main()
