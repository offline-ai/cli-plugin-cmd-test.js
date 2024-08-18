# AI Client Test Command

> 【English|[中文](./README.cn.md)】
---

The [Offline AI Client](https://npmjs.org/package/@offline-ai/cli) builtin command plugin for test [Programable Prompt Engine](https://github.com/offline-ai/ppe)(Agent) Script.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/%40offline-ai%2Fcli-plugin-cmd-config.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-config)
[![Downloads/week](https://img.shields.io/npm/dw/%40offline-ai%2Fcli-plugin-cmd-config.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-config)

# Quick Start

Before using, you need to first install the [Offline AI Client](https://npmjs.org/package/@offline-ai/cli).

# Install

```bash
#If not already installed, install the client:
npm install -g @offline-ai/cli
```

<!-- toc -->
* [AI Client Test Command](#ai-client-test-command)
* [Quick Start](#quick-start)
* [Install](#install)
* [Commands](#commands)
<!-- tocstop -->

# Commands

<!-- commands -->
* [`ai run [DATA]`](#ai-run-data)
* [`ai test`](#ai-test)

## `ai run [DATA]`

💻 Run ai-agent script file.

```
USAGE
  $ ai run [DATA] [--json] [-c <value>] [--banner] [-u <value>] [-s <value>...] [-l
    silence|fatal|error|warn|info|debug|trace] [-h <value>] [-n] [-k] [-t <value> -i] [--no-chats] [--no-inputs ] [-m]
    [-f <value>] [-d <value>] [-a <value>] [-b <value>] [-p <value>...] [--consoleClear]

ARGUMENTS
  DATA  the json data which will be passed to the ai-agent script

FLAGS
  -a, --arguments=<value>      the json data which will be passed to the ai-agent script
  -b, --brainDir=<value>       the brains(LLM) directory
  -c, --config=<value>         the config file
  -d, --dataFile=<value>       the data file which will be passed to the ai-agent script
  -f, --script=<value>         the ai-agent script file name or id
  -h, --histories=<value>      the chat histories folder to record
  -i, --[no-]interactive       interactive mode
  -k, --backupChat             whether to backup chat history before start, defaults to false
  -l, --logLevel=<option>      the log level
                               <options: silence|fatal|error|warn|info|debug|trace>
  -m, --[no-]stream            stream mode, defaults to true
  -n, --[no-]newChat           whether to start a new chat history, defaults to false in interactive mode, true in
                               non-interactive
  -p, --promptDirs=<value>...  the prompts template directory
  -s, --agentDirs=<value>...   the search paths for ai-agent script file
  -t, --inputs=<value>         the input histories folder for interactive mode to record
  -u, --api=<value>            the api URL
      --[no-]banner            show banner
      --[no-]consoleClear      Whether console clear after stream output, default to true in interactive, false to
                               non-interactive
      --no-chats               disable chat histories, defaults to false
      --no-inputs              disable input histories, defaults to false

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  💻 Run ai-agent script file.

  Execute ai-agent script file and return result. with `-i` to interactive.

EXAMPLES
  $ ai run -f ./script.yaml "{content: 'hello world'}" -l info
  ┌────────────────────
  │[info]:Start Script: ...
```

_See code: [@offline-ai/cli-plugin-core](https://github.com/offline-ai/cli-plugin-core.js/blob/v0.3.0/src/commands/run/index.ts)_

## `ai test`

🔬 Run simple ai-agent fixtures to test(draft).

```
USAGE
  $ ai test [--json] [-c <value>] [--banner] [-u <value>] [-s <value>...] [-l
    silence|fatal|error|warn|info|debug|trace] [-h <value>] [-n] [-k] [-t <value> -i] [--no-chats] [--no-inputs ] [-m]
    [-f <value>] [-d <value>] [-a <value>] [-b <value>] [-p <value>...] [--consoleClear]

FLAGS
  -a, --arguments=<value>      the json data which will be passed to the ai-agent script
  -b, --brainDir=<value>       the brains(LLM) directory
  -c, --config=<value>         the config file
  -d, --dataFile=<value>       the data file which will be passed to the ai-agent script
  -f, --script=<value>         the ai-agent fixture file path
  -h, --histories=<value>      the chat histories folder to record
  -i, --[no-]interactive       interactive mode
  -k, --backupChat             whether to backup chat history before start, defaults to false
  -l, --logLevel=<option>      the log level
                               <options: silence|fatal|error|warn|info|debug|trace>
  -m, --stream                 stream mode, defaults to false
  -n, --[no-]newChat           whether to start a new chat history, defaults to false in interactive mode, true in
                               non-interactive
  -p, --promptDirs=<value>...  the prompts template directory
  -s, --agentDirs=<value>...   the search paths for ai-agent script file
  -t, --inputs=<value>         the input histories folder for interactive mode to record
  -u, --api=<value>            the api URL
      --[no-]banner            show banner
      --[no-]consoleClear      Whether console clear after stream output, default to true in interactive, false to
                               non-interactive
      --no-chats               disable chat histories, defaults to false
      --no-inputs              disable input histories, defaults to false

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  🔬 Run simple ai-agent fixtures to test(draft).

  Execute fixtures file to test ai-agent script file and check result.

EXAMPLES
  $ ai test -f ./fixture.yaml -l info
```

_See code: [src/commands/test/index.ts](https://github.com/offline-ai/cli-plugin-cmd-test.js/blob/v0.1.1/src/commands/test/index.ts)_
<!-- commandsstop -->
