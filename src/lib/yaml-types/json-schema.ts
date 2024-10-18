import { Ajv, ValidateFunction } from "ajv"

import { createYamlObjectTag, YamlTypeBaseObject } from "@isdk/ai-tool";

const ajv = new Ajv()

export class YamlTypeJsonSchema extends YamlTypeBaseObject {
  static YAMLTag = '!json-schema'
  declare _validate: ValidateFunction<any>

  static isInstance(obj: any): obj is YamlTypeJsonSchema {
    if (!obj || typeof obj !== 'object') return false
    let result = obj instanceof YamlTypeJsonSchema
    if (!result) {
      result = obj.constructor.YAMLTag === YamlTypeJsonSchema.YAMLTag
    }
    return result
  }

  static create(schema?: any): YamlTypeJsonSchema {
    if (!(schema instanceof YamlTypeJsonSchema)) {
      schema = new YamlTypeJsonSchema(schema)
    }
    return schema
  }
  static validate(schema:any, data: any) {
    if (!(schema instanceof YamlTypeJsonSchema)) {
      schema = new YamlTypeJsonSchema(schema)
    }
    return schema.validate(data)
  }
  constructor(options?: any) {
    super(options)

    Object.defineProperty(this, '_validate', {
      writable: false,
      enumerable: false,
      value: ajv.compile<any>(this.toJSON()),
    })
  }

  toJSON() {
    // filter private properties
    const result = Object.fromEntries(Object.entries(this).filter(([k]) => !k.startsWith('_')))
    return result
  }

  validate(data: any) {
    return this._validate(data)
  }

  getErrors() {
    return this._validate.errors
  }
}

export const yamlJsonSchemaTag = createYamlObjectTag(YamlTypeJsonSchema.YAMLTag, YamlTypeJsonSchema)