import { Ajv, ValidateFunction } from "ajv"
import ajvKeywords from 'ajv-keywords'
import ajvFormats from 'ajv-formats'
import { createYamlObjectTag, YamlTypeBaseObject } from "@isdk/ai-tool";

const ajv = new Ajv()

// @ts-expect-error "typeof ajvKeywords"
ajvKeywords(ajv);
// @ts-expect-error "typeof ajvFormats"
ajvFormats(ajv)

const ValidateSymbol = Symbol('validate')

export class YamlTypeJsonSchema extends YamlTypeBaseObject {
  static YAMLTag = '!json-schema'
  declare [ValidateSymbol]: ValidateFunction<any>

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
    return schema[ValidateSymbol](data)
  }

  static getErrors(schema: YamlTypeJsonSchema) {
    return schema[ValidateSymbol].errors
  }

  constructor(options?: any) {
    super(options)

    Object.defineProperty(this, ValidateSymbol, {
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
    return this[ValidateSymbol](data)
  }

  getErrors() {
    return this[ValidateSymbol].errors
  }
}

export const yamlJsonSchemaTag = createYamlObjectTag(YamlTypeJsonSchema.YAMLTag, YamlTypeJsonSchema)