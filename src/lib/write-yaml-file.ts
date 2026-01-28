import fs from 'fs/promises'
import { stringifyYaml } from '@isdk/ai-tool'

export async function writeYamlFile(filepath: string, data: any) {
  const str = stringifyYaml(data)
  await fs.writeFile(filepath, str)
}