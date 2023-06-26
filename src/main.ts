import * as core from '@actions/core'
import * as child from 'child_process'

import Jira from './jira'

async function run(): Promise<void> {
  try {
    const RegExpFromString = require('regexp-from-string')

    const base: string = core.getInput('base_branch') || 'origin/master'
    const release: string = core.getInput('release_branch')
    const jiraConfig = {
      host: core.getInput('jira_host'),
      email: core.getInput('jira_email'),
      token: core.getInput('jira_token'),
      baseUrl: core.getInput('jira_base_url'),
      ticketIDPattern: RegExpFromString(core.getInput('jira_ticket_id_pattern'))
    }
    child.exec(`git log ${base}..${release}`, async (err, stdout) => {
      if (err) {
        core.setFailed(err.message)
      } else {
        core.debug(`The stdout from git log: ${stdout.toString()}`)
        const {SourceControl} = require('jira-changelog')
        const source = new SourceControl(jiraConfig)
        const range = {
          from: release,
          to: base
        }

        const jira = new Jira(jiraConfig)
        core.debug(`Getting range ${range.from}...${range.to} commit logs`)
        const commitLogs = await source.getCommitLogs('./', range)
        //core.debug(commitLogs)
        jira.generate(commitLogs, '1.0.0')
      }
    })
    core.debug(`Base brnach ${base}; base branch ${release}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
