import { registerYamlTag } from '@isdk/ai-tool'
import { yamlJsonSchemaTag } from './json-schema.js'

export * from './json-schema.js'

registerYamlTag(yamlJsonSchemaTag)

