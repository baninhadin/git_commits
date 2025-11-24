#!/usr/bin/env ts-node

import { execSync } from 'child_process'
import { appendFileSync, existsSync, writeFileSync } from 'fs'
import * as readline from 'readline'

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

// Helper function to execute shell commands
function executeCommand(command: string): void {
  try {
    execSync(command, { stdio: 'inherit' })
  } catch (error) {
    console.error(`Error executing command: ${command}`)
    console.error(error)
    process.exit(1)
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
function makeCommitsOnDate(date: Date, count: number): void {
  // Create log.txt if it doesn't exist
  if (!existsSync('log.txt')) {
    writeFileSync('log.txt', '# Commit Log\n\n')
    executeCommand('git add log.txt')
    executeCommand('git commit -m "Initialize log.txt"')
  }

  // Format date for Git (ISO 8601 format)
  const formattedDate = date.toISOString()
  const dateStr = date.toISOString().split('T')[0]

  for (let i = 1; i <= count; i++) {
    // Append a new entry to log.txt
    const timestamp = new Date().toISOString()
    appendFileSync(
      'log.txt',
      `Commit ${i} made at real time ${timestamp} but dated ${dateStr}\n`
    )

    // Add and commit with the specified date
    executeCommand('git add log.txt')

    // Use --date parameter which works more reliably across platforms
    const commitCommand = `git commit --date="${formattedDate}" -m "Update log: commit ${i} of ${count} for ${dateStr}"`
    executeCommand(commitCommand)
  }
}

// Check if command line arguments are provided
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
        console.log(
          `Processing ${currentDate.toISOString().split('T')[0]} (${
            patternData.pattern
          } pattern, ${type})...`
        )
        makeCommitsOnDate(new Date(currentDate), count)
        console.log(`  ✓ Added ${count} commits\n`)

        if (patternData.isDark) {
          darkDatesCount++
        } else {
          lightDatesCount++
        }
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
            (lightCountStr) => {
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
                    console.log(
                      `Processing ${currentDate.toISOString().split('T')[0]} (${
                        patternData.pattern
                      } pattern, ${type})...`
                    )
                    makeCommitsOnDate(new Date(currentDate), count)
                    console.log(`  ✓ Added ${count} commits\n`)

                    if (patternData.isDark) {
                      darkDatesCount++
                    } else {
                      lightDatesCount++
                    }
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
