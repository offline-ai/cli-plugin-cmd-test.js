export function normalizeMessages(rawMessages: any[]): any[] {
  if (!rawMessages || !Array.isArray(rawMessages)) {
    return []
  }

  return rawMessages.map((msg) => {
    const { role, content, tools } = msg
    const mappedMsg: any = { role, content }
    if (tools && typeof tools === 'object') {
      mappedMsg.tools = Object.values(tools).map((t: any) => ({
        name: t.name,
        args: t.args,
        result: t.content,
      }))
    }
    return mappedMsg
  })
}
