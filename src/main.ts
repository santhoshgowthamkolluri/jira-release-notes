import * as core from '@actions/core'
import * as child from 'child_process'

import Jira from './jira'

const template = `


Jira Tickets
---------------------
<% tickets.all.forEach((ticket) => { %>
  * [<%= ticket.fields.issuetype.name %>] - [<%= ticket.key %>](<%= jira.baseUrl + '/browse/' + ticket.key %>) <%= ticket.fields.summary -%>
<% }); -%>
<% if (!tickets.all.length) {%> ~ None ~ <% } %>

Other Commits
---------------------
<% commits.noTickets.forEach((commit) => { %>
  * <%= commit.authorName %> - [<%= commit.revision.substr(0, 7) %>] - <%= commit.summary -%>
<% }); -%>
<% if (!commits.noTickets.length) {%> ~ None ~ <% } %>

`

async function run(): Promise<void> {
  try {
    const RegExpFromString = require('regexp-from-string')

    const base: string = core.getInput('base_branch')
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
        const changelog = await jira.generate(commitLogs, '1.0.0')
        const data = await transformCommitLogs(changelog, jiraConfig)
        console.log('changelog geenrated')
        const ejs = require('ejs')
        const Entities = require('html-entities')

        const changelogMessage = ejs.render(template, data)
        const entitles = new Entities.AllHtmlEntities()
        console.log('Changelog message entry:')
        console.log(entitles.decode(changelogMessage))

        core.setOutput('changelog_message', changelogMessage)
      }
    })
    core.debug(`Base brnach ${base}; base branch ${release}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function transformCommitLogs(logs, jiraConfig) {
  // Tickets and their commits
  const _ = require('lodash')
  const ticketHash = logs.reduce((all, log) => {
    log.tickets.forEach(ticket => {
      all[ticket.key] = all[ticket.key] || ticket
      all[ticket.key].commits = all[ticket.key].commits || []
      all[ticket.key].commits.push(log)
    })
    return all
  }, {})
  const ticketList = _.sortBy(
    Object.values(ticketHash),
    ticket => ticket.fields.issuetype.name
  )

  // Pending ticket owners and their tickets/commits
  const reporters = {}

  // Output filtered data
  return {
    commits: {
      all: logs,
      tickets: logs.filter(commit => commit.tickets.length),
      noTickets: logs.filter(commit => !commit.tickets.length)
    },
    tickets: {
      all: ticketList
    },
    jira: jiraConfig
  }
}

run()
