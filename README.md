# AI Client Test Command

> 【English|[中文](./README.cn.md)】
---

The [Offline AI Client](https://npmjs.org/package/@offline-ai/cli) builtin command plugin for test [Programable Prompt Engine](https://github.com/offline-ai/ppe)(Agent) Script.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/%40offline-ai%2Fcli-plugin-cmd-test.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-test)
[![Downloads/week](https://img.shields.io/npm/dw/%40offline-ai%2Fcli-plugin-cmd-test.svg)](https://npmjs.org/package/@offline-ai/cli-plugin-cmd-test)

<!-- toc -->
* [AI Client Test Command](#ai-client-test-command)
* [Quick Start](#quick-start)
* [Install](#install)
* [File Naming Conventions](#file-naming-conventions)
* [Run test](#run-test)
* [Front-matter configurations:](#front-matter-configurations)
* [(Optional) Forcefully specify the PPE script filename to run, ignoring the conventionally agreed PPE filename](#optional-forcefully-specify-the-ppe-script-filename-to-run-ignoring-the-conventionally-agreed-ppe-filename)
* [the test fixture item:](#the-test-fixture-item)
* [declare the template data varaibles which can be used in the test:](#declare-the-template-data-varaibles-which-can-be-used-in-the-test)
* [the varaiable can be a template string too.](#the-varaiable-can-be-a-template-string-too)
* [the test fixture item:](#the-test-fixture-item)
* [Generate Output](#generate-output)
* [valid Data:](#valid-data)
* [invalid Data:](#invalid-data)
* [Commands](#commands)
<!-- tocstop -->

# Quick Start

Before using, you need to install the [Offline AI Client](https://npmjs.org/package/@offline-ai/cli).

# Install

Install the Client If you haven't already installed the client, use the following command to install it globally:

```bash
npm install -g @offline-ai/cli
```

# File Naming Conventions

* The test fixture file should be in the same directory as the AI Prompt/Agent script file.
* The test fixture file name should be `[basename].fixture.yaml`.
* The AI Prompt/Agent（PPE） script file name should be `[basename][.additional-name].ai.yaml`.
  * The `[.additional-name]` is optional.

# Run test

Running Tests To run the test fixture file, use the following command:

```bash
ai test "[basename].fixture.yaml"
```

This command will run all matching Prompt/Agent script files in the same directory, one by one.

Test Fixture Data Format The test fixture file uses YAML format.

Each test item includes input, expected output, and an optional skip flag:

```yaml
---
# Front-matter configurations:
description: 'This is a AI test fixtures file'
# (Optional) Forcefully specify the PPE script filename to run, ignoring the conventionally agreed PPE filename
script: '[basename].ai.yaml'
---
# the test fixture item:
- input: # the input passed into the script
    content: '...'
    ...
  output: # the expected output to compare the script's output
    ...
    name: !re /^First/ # can be a regexp string to match
  not: true   # Inverse match flag, if true, the test succeeds when the expected output does not match.
  skip: true  # Optional flag to skip the test
  only: true  # Optional flag to run only this test; only one of 'skip' or 'only' can be set, and 'only' takes precedence
```

Fixtures Demo: https://github.com/offline-ai/cli/tree/main/examples/split-text-paragraphs

Skipping Tests in PPE Script Front Matter To specify that a script should be skipped during testing, set `skip: true` in the script's front matter:

```yaml
---
description: 'This is a AI script'
test:
  skip: true
  only: true  # Optional flag to run only this script; only one of 'skip' or 'only' can be set, and 'only' takes precedence
---
```

## Template Data

The template data can be used in the test fixture file.

```yaml
---
description: 'This is a AI test fixtures file'
# declare the template data varaibles which can be used in the test:
content: 'hi world'
# the varaiable can be a template string too.
AnswerPattern: /The Answer is {{answer}}.$/
---
# the test fixture item:
- input: # the input passed into the script
    content: '{{content}}'
    ...
  output: "{{AnswerPattern}}"
  answer: 42
```

The Input/Output can be template string too.

```yaml
---
description: 'This is a AI test fixtures file'
input:
  content: '{{question}}\nAt last answer in the end: "The Answer is {{type}}."'
output: /The Answer is {{answer}}.$/i
---
- question: Would a nickel fit inside a koala pouch?
  type: yes/no
  answer: yes
```

Default template data:

* `__script_dir__`: the current script file directory.
* `__fixture_dir__`: the fixture file directory.

## `Diff` String Validation

Using `diff` can help validate and supplement strings. For example, it allows the existence of extra blank lines. This ensures that when there are minor differences in the string results, they can still pass the validation.

```yaml
---
description: 'This is a AI test fixtures file'
---
- input: # Input content
    content: '{{content}}'
    ...
  output: "This is the expected output"
  diff:
    - add: true # Allows additional blank lines to be added
      value: '\n'
```

## JSON Schema Validation

* If the `output` convention is used in the PPE script, the test will automatically use this `output` as a `JSON-Schema` to validate the output.
* In tests, you can use `outputSchema` to validate the input with a `JSON-Schema`.
* In tests, you can use `checkSchema` to temporarily disable `JSON-Schema` validation, which defaults to `true`.
* You can also disable `JSON-Schema` validation via the command line: `ai test --no-checkSchema`.
* The priority of `checkSchema` is: `command-line argument > fixture item > fixture front-matter > default value`.

```yaml
---
description: 'This is an AI test fixtures file'
checkSchema: false # Can disable `JSON-Schema` validation, default is true
---
- input: # Input content
    content: '{{content}}'
    ...
  outputSchema:
    type: object
    properties:
      name:
        type: string
        pattern: "^First" # or use non-standard regexp: /^First/i
        minLength: 2
      age:
        type: number
        minimum: 18
  checkSchema: false # Can also temporarily disable `JSON-Schema` validation in the fixture item

# Generate Output

Enable this `-g` or `--generateOutput` flag. It will use the output of the script and write into it if there are no output in the fixtures file.

```bash
ai test "[basename].fixture.yaml" --generateOutput
```

### JSON Schema Keywords Extensions

* number:
  * `range` and `exclusiveRange`: `range: [1, 3]`
    * Syntax sugar for the combination of minimum and maximum keywords (or exclusiveMinimum and exclusiveMaximum), also fails schema compilation if there are no numbers in the range.
* string:
  * `regexp`: `"/foo/i"`, `{pattern: "bar", flags: "i"}`
  * `transform`: `["trim", "toLowerCase"]`
    * `trim`: remove whitespace from start and end
    * `trimStart`/`trimLeft`: remove whitespace from start
    * `trimEnd`/`trimRight`: remove whitespace from end
    * `toLowerCase`: convert to lower case
    * `toUpperCase`: convert to upper case
    * `toEnumCase`: change string case to be equal to one of `enum` values in the schema
      * `transform: ["trim", "toEnumCase"], enum: ["pH"],`
* array:
  * `uniqueItemProperties`:  check that some properties in array items are unique.
* objects:
  * `allRequired`: boolean, require the presence of all properties used in properties keyword in the same schema object.
  * `anyRequired`:  require the presence of any (at least one) property from the list. `anyRequired: ["foo", "bar"],`
  * `oneRequired`:  require the presence of only one property from the list.
  * `patternRequired`: require the presence of properties that match some pattern(s). `patternRequired: ["f.*o", "b.*r"],`
  * `prohibited`: prohibit that any of the properties in the list is present in the object.
  * `deepProperties`:  validate deep properties (identified by JSON pointers).

    ```js
    deepProperties: {
      "/users/1/role": {enum: ["admin"]},
    },
    ```

  * `deepRequired`: check that some deep properties (identified by JSON pointers) are available. `deepRequired: ["/users/1/role"],`
  * `dynamicDefaults`:  allows to assign dynamic defaults to properties, such as timestamps, unique IDs etc.
    * This keyword only works if `useDefaults` options is used and not inside `anyOf` keywords etc.
    * predefined dynamic default functions:
      * "timestamp" - current timestamp in milliseconds
      * "datetime" - current date and time as string (ISO, valid according to date-time format)
      * "date" - current date as string (ISO, valid according to date format)
      * "time" - current time as string (ISO, valid according to time format)
      * "random" - pseudo-random number in `[0, 1)` interval
      * "randomint" - pseudo-random integer number. If string is used as a property value, the function will randomly return 0 or 1. If object `{ func: 'randomint', args: { max: N } }` is used then the default will be an integer number in `[0, N)` interval.
      * "seq" - sequential integer number starting from 0.

### Defined String Formats for JSON Schema

- _date_: full-date according to [RFC3339](http://tools.ietf.org/html/rfc3339#section-5.6).
- _time_: time (time-zone is mandatory).
- _date-time_: date-time (time-zone is mandatory).
- _iso-time_: time with optional time-zone.
- _iso-date-time_: date-time with optional time-zone.
- _duration_: duration from [RFC3339](https://tools.ietf.org/html/rfc3339#appendix-A)
- _uri_: full URI.
- _uri-reference_: URI reference, including full and relative URIs.
- _uri-template_: URI template according to [RFC6570](https://tools.ietf.org/html/rfc6570)
- _url_ (deprecated): [URL record](https://url.spec.whatwg.org/#concept-url).
- _email_: email address.
- _hostname_: host name according to [RFC1034](http://tools.ietf.org/html/rfc1034#section-3.5).
- _ipv4_: IP address v4.
- _ipv6_: IP address v6.
- _regex_: tests whether a string is a valid regular expression by passing it to RegExp constructor.
- _uuid_: Universally Unique IDentifier according to [RFC4122](http://tools.ietf.org/html/rfc4122).
- _json-pointer_: JSON-pointer according to [RFC6901](https://tools.ietf.org/html/rfc6901).
- _relative-json-pointer_: relative JSON-pointer according to [this draft](http://tools.ietf.org/html/draft-luff-relative-json-pointer-00).
- _byte_: base64 encoded data according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)
- _int32_: signed 32 bits integer according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)
- _int64_: signed 64 bits according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)
- _float_: float according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)
- _double_: double according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)
- _password_: password string according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)
- _binary_: binary string according to the [openApi 3.0.0 specification](https://spec.openapis.org/oas/v3.0.0#data-types)

#### Keywords to compare values: `formatMaximum` / `formatMinimum` and `formatExclusiveMaximum` / `formatExclusiveMinimum`

These keywords allow to define minimum/maximum constraints when the format keyword defines.

These keywords apply only to strings.

```yaml
---
outputSchema:
  type: "string",
  format: "date",
  formatMinimum: "2016-02-06",
  formatExclusiveMaximum: "2016-12-27",
---
# valid Data:
- input:
    echo: "2016-02-06"
- input:
    echo: "2016-12-26"
# invalid Data:
- input:
    echo: "2016-02-05"
- input:
    echo: "2016-12-27"
- input:
    echo: "abc"
```

# Commands

<!-- commands -->
* [`ai run [FILE] [DATA]`](#ai-run-file-data)
* [`ai test [FILE]`](#ai-test-file)

## `ai run [FILE] [DATA]`

💻 Run ai-agent script file.

```
USAGE
  $ ai run [FILE] [DATA] [--json] [--config <value>] [--banner] [-u <value>] [--apiKey <value>] [-s
    <value>...] [--logLevelMaxLen <value> -l trace|debug|verbose|info|notice|warn|error|fatal|print|silence]
    [--histories <value>] [-n] [-k] [-t <value> -i] [--no-chats] [--no-inputs ] [-m] [-f <value>] [-d <value>] [-D
    <value>...] [-a <value>] [-b <value>] [-p <value>...] [-L <value>] [-A <value>] [-e true|false|line] [-C <value>]
    [-P <value>] [--consoleClear]

ARGUMENTS
  FILE  the script file path, or the json data when `-f` switch is set
  DATA  the json data which will be passed to the ai-agent script

FLAGS
  -A, --aiPreferredLanguage=<value>    the ISO 639-1 code for the AI preferred language to translate the user input
                                       automatically, eg, en, etc.
  -C, --streamEchoChars=<value>        [default: 80] stream echo max characters limit
  -D, --data=<value>...                the data which will be passed to the ai-agent script: key1=value1 key2=value2
  -L, --userPreferredLanguage=<value>  the ISO 639-1 code for the user preferred language to translate the AI result
                                       automatically, eg, en, zh, ja, ko, etc.
  -P, --provider=<value>               the LLM provider, defaults to llamacpp
  -a, --arguments=<value>              the json data which will be passed to the ai-agent script
  -b, --brainDir=<value>               the brains(LLM) directory
  -d, --dataFile=<value>               the data file which will be passed to the ai-agent script
  -e, --streamEcho=<option>            [default: line] stream echo mode
                                       <options: true|false|line>
  -f, --script=<value>                 the ai-agent script file name or id
  -i, --[no-]interactive               interactive mode
  -k, --backupChat                     whether to backup chat history before start, defaults to false
  -l, --logLevel=<option>              the log level
                                       <options: trace|debug|verbose|info|notice|warn|error|fatal|print|silence>
  -m, --[no-]stream                    stream mode, defaults to true
  -n, --[no-]newChat                   whether to start a new chat history, defaults to false in interactive mode, true
                                       in non-interactive
  -p, --promptDirs=<value>...          the prompts template directory
  -s, --agentDirs=<value>...           the search paths for ai-agent script file
  -t, --inputs=<value>                 the input histories folder for interactive mode to record
  -u, --api=<value>                    the api URL
      --apiKey=<value>                 the api key (optional)
      --[no-]banner                    show banner
      --config=<value>                 the config file
      --[no-]consoleClear              Whether console clear after stream echo output, default to true
      --histories=<value>              the chat histories folder to record
      --logLevelMaxLen=<value>         the max length of log item to display
      --no-chats                       disable chat histories, defaults to false
      --no-inputs                      disable input histories, defaults to false

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

_See code: [@offline-ai/cli-plugin-core](https://github.com/offline-ai/cli-plugin-core.js/blob/v0.11.2/src/commands/run/index.ts)_

## `ai test [FILE]`

🔬 Run simple AI fixtures to test(draft).

```
USAGE
  $ ai test [FILE] [--json] [--config <value>] [--banner] [-u <value>] [--apiKey <value>] [-s <value>...]
    [--logLevelMaxLen <value> -l trace|debug|verbose|info|notice|warn|error|fatal|print|silence] [--histories <value>]
    [-n] [-k] [-t <value> ] [--no-chats] [--no-inputs ] [-m] [-f <value>] [-d <value>] [-D <value>...] [-a <value>] [-b
    <value>] [-p <value>...] [-L <value>] [-A <value>] [-e true|false|line] [-e <value>] [-P <value>] [--consoleClear]
    [-i <value>...] [-x <value>...] [-g] [-c <value>] [--checkSchema]

ARGUMENTS
  FILE  the test fixtures file path

FLAGS
  -A, --aiPreferredLanguage=<value>    the ISO 639-1 code for the AI preferred language to translate the user input
                                       automatically, eg, en, etc.
  -D, --data=<value>...                the data which will be passed to the ai-agent script: key1=value1 key2=value2
  -L, --userPreferredLanguage=<value>  the ISO 639-1 code for the user preferred language to translate the AI result
                                       automatically, eg, en, zh, ja, ko, etc.
  -P, --provider=<value>               the LLM provider, defaults to llamacpp
  -a, --arguments=<value>              the json data which will be passed to the ai-agent script
  -b, --brainDir=<value>               the brains(LLM) directory
  -c, --runCount=<value>               [default: 1] The number of times to run the test case to check if the results are
                                       consistent with the previous run, and to record the counts of matching and
                                       non-matching results
  -d, --dataFile=<value>               the data file which will be passed to the ai-agent script
  -e, --streamEcho=<option>            [default: line] stream echo mode, defaults to true
                                       <options: true|false|line>
  -e, --streamEchoChars=<value>        [default: 80] stream echo max characters limit, defaults to no limit
  -f, --script=<value>                 the ai-agent script file name or id
  -g, --generateOutput                 generate output to fixture file if no output is provided
  -i, --includeIndex=<value>...        the index of the fixture to run
  -k, --backupChat                     whether to backup chat history before start, defaults to false
  -l, --logLevel=<option>              the log level
                                       <options: trace|debug|verbose|info|notice|warn|error|fatal|print|silence>
  -m, --[no-]stream                    stream mode, defaults to true
  -n, --[no-]newChat                   whether to start a new chat history, defaults to false in interactive mode, true
                                       in non-interactive
  -p, --promptDirs=<value>...          the prompts template directory
  -s, --agentDirs=<value>...           the search paths for ai-agent script file
  -t, --inputs=<value>                 the input histories folder for interactive mode to record
  -u, --api=<value>                    the api URL
  -x, --excludeIndex=<value>...        the index of the fixture to exclude from running
      --apiKey=<value>                 the api key (optional)
      --[no-]banner                    show banner
      --[no-]checkSchema               Whether check JSON schema of output
      --config=<value>                 the config file
      --[no-]consoleClear              Whether console clear after stream output, default to true in interactive, false
                                       to non-interactive
      --histories=<value>              the chat histories folder to record
      --logLevelMaxLen=<value>         the max length of log item to display
      --no-chats                       disable chat histories, defaults to false
      --no-inputs                      disable input histories, defaults to false

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  🔬 Run simple AI fixtures to test(draft).

  Execute fixtures file to test AI script file and check result.

EXAMPLES
  $ ai test ./named.fixture.yaml -l info
```

_See code: [src/commands/test/index.ts](https://github.com/offline-ai/cli-plugin-cmd-test.js/blob/v0.3.12/src/commands/test/index.ts)_
<!-- commandsstop -->
