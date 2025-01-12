#!/usr/bin/env ts-node

import { execSync } from 'child_process'
import { appendFileSync, existsSync, writeFileSync } from 'fs'
import * as readline from 'readline'

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

// Function to make commits with a specific date
function makeCommitsOnDate(date: string, count: number): void {
  // Create log.txt if it doesn't exist
  if (!existsSync('log.txt')) {
    writeFileSync('log.txt', '# Commit Log\n\n')
    executeCommand('git add log.txt')
    executeCommand('git commit -m "Initialize log.txt"')
  }

  // Format date for Git (ISO 8601 format)
  const formattedDate = new Date(date).toISOString()

  console.log(`Making ${count} commits dated ${date}...`)

  for (let i = 1; i <= count; i++) {
    // Append a new entry to log.txt
    const timestamp = new Date().toISOString()
    appendFileSync(
      'log.txt',
      `Commit ${i} made at real time ${timestamp} but dated ${date}\n`
    )

    // Add and commit with the specified date
    executeCommand('git add log.txt')

    // Use --date parameter which works more reliably across platforms
    const commitCommand = `git commit --date="${formattedDate}" -m "Update log: commit ${i} of ${count} for ${date}"`
    executeCommand(commitCommand)

    console.log(`Completed commit ${i} of ${count}`)
  }

  console.log(`\nAll ${count} commits created with date ${date}`)
  console.log(`Don't forget to push your changes: git push origin main`)
}

// Prompt user for input
rl.question('Enter target date (YYYY-MM-DD): ', (date) => {
  rl.question('Enter number of commits to make: ', (countStr) => {
    const count = parseInt(countStr, 10)

    if (isNaN(count) || count <= 0) {
      console.error('Please enter a valid positive number for commit count')
      rl.close()
      return
    }

    makeCommitsOnDate(date, count)
    rl.close()
  })
})
