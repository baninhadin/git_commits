#!/usr/bin/env ts-node

import { execSync } from 'child_process'
import { appendFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import * as readline from 'readline'
import * as path from 'path'

// Pattern definitions
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

// Create an interface for reading from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Helper function to add delay (async)
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Async helper to execute shell commands with retry & index.lock handling
async function executeCommand(
  command: string,
  maxRetries = 10,
  retryDelayMs = 1000
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use pipe so we can inspect output, then print it
      const out = execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] })
      if (out && out.length > 0) {
        process.stdout.write(out.toString())
      }
      return
    } catch (err: any) {
      const msg =
        (err?.stderr && err.stderr.toString()) ||
        (err?.stdout && err.stdout.toString()) ||
        (err?.message as string) ||
        ''

      // This warning is harmless, not why it failed:
      // "LF will be replaced by CRLF in log.txt."
      // Commit usually still succeeds; if we're here, it failed for another reason.

      // Handle index.lock specifically
      if (msg.includes('index.lock')) {
        console.warn(
          `[WARN] index.lock detected while running "${command}". Attempt ${attempt}/${maxRetries}`
        )

        const lockPath = path.join(process.cwd(), '.git', 'index.lock')
        if (existsSync(lockPath)) {
          try {
            unlinkSync(lockPath)
            console.warn(`[INFO] Removed lock file: ${lockPath}`)
          } catch (e) {
            console.warn(
              `[WARN] Failed to remove lock file ${lockPath}: ${
                (e as Error).message
              }`
            )
          }
        }

        if (attempt < maxRetries) {
          await delay(retryDelayMs)
          continue
        } else {
          console.error(
            `[FATAL] Still getting index.lock after ${maxRetries} attempts for "${command}".`
          )
          throw err
        }
      }

      // Other git errors → retry as well, but still bounded
      console.warn(
        `[WARN] Git command failed (attempt ${attempt}/${maxRetries}) for "${command}".`
      )
      console.warn(msg.trim())

      if (attempt < maxRetries) {
        await delay(retryDelayMs)
        continue
      } else {
        console.error(
          `[FATAL] Giving up after ${maxRetries} attempts for "${command}".`
        )
        throw err
      }
    }
  }
}

// Get pattern for a specific date
function getPatternForDate(date: Date): {
  pattern: 'H' | 'E'
  weekIndex: number
  dayIndex: number
  isDark: boolean
} | null {
  if (date < startDate) {
    return null
  }

  const dayDifference = Math.floor(
    (date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  )

  const dayIndex = dayDifference % 7
  const weekIndex = Math.floor(dayDifference / 7) % 4
  // Pattern alternates: first 56 days (8 weeks) are H, then alternates every 28 days
  // This ensures Feb 12-18 (day 31) is H pattern, week 0
  let pattern: 'H' | 'E'
  if (dayDifference < 56) {
    pattern = 'H'
  } else {
    const cycle28 = Math.floor((dayDifference - 56) / (4 * 7))
    pattern = cycle28 % 2 === 0 ? 'E' : 'H'
  }

  const currentPattern = pattern === 'H' ? HPattern : EPattern
  const isDark = currentPattern[dayIndex]?.[weekIndex] === 'dark'

  return { pattern, weekIndex, dayIndex, isDark }
}

// Function to make commits with a specific date
async function makeCommitsOnDate(date: Date, count: number): Promise<void> {
  // Create log.txt if it doesn't exist
  if (!existsSync('log.txt')) {
    writeFileSync('log.txt', '# Commit Log\n\n')
    await executeCommand('git add log.txt')
    await executeCommand('git commit -m "Initialize log.txt"')
    // Small pause after initializing to avoid immediate lock race
    await delay(500)
  }

  // Format date for Git (ISO 8601 format)
  const formattedDate = date.toISOString()
  const dateStr = date.toISOString().split('T')[0]

  for (let i = 1; i <= count; i++) {
    const timestamp = new Date().toISOString()
    appendFileSync(
      'log.txt',
      `Commit ${i} made at real time ${timestamp} but dated ${dateStr}\n`
    )

    await executeCommand('git add log.txt')

    const commitCommand = `git commit --date="${formattedDate}" -m "Update log: commit ${i} of ${count} for ${dateStr}"`
    await executeCommand(commitCommand)

    if (i < count) {
      // Delay between commits
      await delay(1200)
    }
  }
}

// Main execution function
async function main() {
  const args = process.argv.slice(2)

  if (args.length >= 4) {
    // Use command line arguments: startDate endDate darkCount lightCount
    const startDateStr = args[0]
    const endDateStr = args[1]
    const darkCount = parseInt(args[2], 10)
    const lightCount = parseInt(args[3], 10)

    if (
      isNaN(darkCount) ||
      darkCount < 0 ||
      isNaN(lightCount) ||
      lightCount < 0
    ) {
      console.error('Please enter valid non-negative numbers for commit counts')
      process.exit(1)
    }

    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    end.setHours(23, 59, 59, 999) // Include the end date

    console.log(`Processing dates from ${startDateStr} to ${endDateStr}...`)
    console.log(
      `Dark dates: ${darkCount} commits, Light dates: ${lightCount} commits\n`
    )

    let darkDatesCount = 0
    let lightDatesCount = 0
    const currentDate = new Date(start)

    while (currentDate <= end) {
      const patternData = getPatternForDate(currentDate)
      if (patternData) {
        const count = patternData.isDark ? darkCount : lightCount
        const type = patternData.isDark ? 'dark' : 'light'

        if (count > 0) {
          const iso = currentDate.toISOString().split('T')[0]
          console.log(
            `Processing ${iso} (${patternData.pattern} pattern, ${type})...`
          )
          await makeCommitsOnDate(new Date(currentDate), count)
          console.log(`  ✓ Added ${count} commits\n`)

          if (patternData.isDark) {
            darkDatesCount++
          } else {
            lightDatesCount++
          }

          // Delay between days to avoid back-to-back lock issues
          await delay(1800)
        }
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    console.log(`\n✓ Completed!`)
    console.log(`  Dark dates processed: ${darkDatesCount}`)
    console.log(`  Light dates processed: ${lightDatesCount}`)
    console.log(`Don't forget to push your changes: git push origin main`)
  } else {
    // Prompt user for input
    rl.question('Enter start date (YYYY-MM-DD): ', (startDateStr) => {
      rl.question('Enter end date (YYYY-MM-DD): ', (endDateStr) => {
        rl.question(
          'Enter number of commits for dark dates: ',
          (darkCountStr) => {
            rl.question(
              'Enter number of commits for light dates: ',
              async (lightCountStr) => {
                const darkCount = parseInt(darkCountStr, 10)
                const lightCount = parseInt(lightCountStr, 10)

                if (
                  isNaN(darkCount) ||
                  darkCount < 0 ||
                  isNaN(lightCount) ||
                  lightCount < 0
                ) {
                  console.error(
                    'Please enter valid non-negative numbers for commit counts'
                  )
                  rl.close()
                  return
                }

                const start = new Date(startDateStr)
                const end = new Date(endDateStr)
                end.setHours(23, 59, 59, 999)

                console.log(
                  `Processing dates from ${startDateStr} to ${endDateStr}...`
                )
                console.log(
                  `Dark dates: ${darkCount} commits, Light dates: ${lightCount} commits\n`
                )

                let darkDatesCount = 0
                let lightDatesCount = 0
                const currentDate = new Date(start)

                while (currentDate <= end) {
                  const patternData = getPatternForDate(currentDate)
                  if (patternData) {
                    const count = patternData.isDark ? darkCount : lightCount
                    const type = patternData.isDark ? 'dark' : 'light'

                    if (count > 0) {
                      const iso = currentDate.toISOString().split('T')[0]
                      console.log(
                        `Processing ${iso} (${patternData.pattern} pattern, ${type})...`
                      )
                      await makeCommitsOnDate(new Date(currentDate), count)
                      console.log(`  ✓ Added ${count} commits\n`)

                      if (patternData.isDark) {
                        darkDatesCount++
                      } else {
                        lightDatesCount++
                      }

                      // Delay between days
                      await delay(1800)
                    }
                  }
                  currentDate.setDate(currentDate.getDate() + 1)
                }

                console.log(`\n✓ Completed!`)
                console.log(`  Dark dates processed: ${darkDatesCount}`)
                console.log(`  Light dates processed: ${lightDatesCount}`)
                console.log(
                  `Don't forget to push your changes: git push origin main`
                )
                rl.close()
              }
            )
          }
        )
      })
    })
  }
}

// Run the main function
main()
