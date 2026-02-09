import { describe, it, expect } from 'vitest'
import { normalizeMessages } from './normalize-messages.js'

describe('normalizeMessages', () => {
  it('should normalize flat messages with tools', () => {
    const rawMessages = [
      {
        "role": "assistant",
        "content": "你好, 我是张晓明.",
        "name": "张晓明",
      },
      {
        "role": "user",
        "content": "你好啊，晓明. 今天上海和杭州天气如何？",
        "tools": {
          "@weather(location=\"上海\")": {
            "content": "上海天气阴。",
            "args": { "location": "上海" },
            "name": "weather"
          }
        }
      }
    ]

    const expected = [
      {
        role: 'assistant',
        content: '你好, 我是张晓明.'
      },
      {
        role: 'user',
        content: '你好啊，晓明. 今天上海和杭州天气如何？',
        tools: [
          {
            name: 'weather',
            args: { location: '上海' },
            result: '上海天气阴。'
          }
        ]
      }
    ]

    expect(normalizeMessages(rawMessages)).toEqual(expected)
  })

  it('should return empty array for invalid input', () => {
    expect(normalizeMessages(null as any)).toEqual([])
    expect(normalizeMessages({} as any)).toEqual([])
  })
})
