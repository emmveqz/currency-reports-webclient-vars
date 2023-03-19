
import { IBaseBo, IBaseBoFactory } from "@emmveqz/currency-reports-core-interfaces"
import * as BaseBos from "@emmveqz/currency-reports-core/dist/bos"
import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"

// TYPES

export type IVarObj = {
  Name: string,
  Value: string | number | null,
}

export type IExportObj = {
  name: string,
  vars: IVarObj[],
  asType: string,
}

// CONSTANTS

const GEN_FILE = "./web-config-vars.ts"
const BASEENTITY_NAMES_FILENAME = "./web-base-entity-names.ts"

const BASEBOS_NAMES_FILE_TPL = `
import { IPropsNames } from "@emmveqz/currency-reports-core-interfaces"
import * as BaseBos from "@emmveqz/currency-reports-core/dist/bos"
%CONSTANTS`

const GEN_TPL = `
export default {
%s
}
`

const GEN_CONST_TPL = `
export const %s1 = {
%s2
} %s3
`

// FUNCTIONS

const AssertNumeric = (val: number|string): boolean => {
  return (/^-?\d*\.?\d+$/).test(val as unknown as string)
}

export const genConfigVars = (varsFilename: string, callerDirectory: string, publicVarNames: string[], outputDirectory: string = callerDirectory) => {
  const vars: IVarObj[] = []
  const varsFile = path.resolve(callerDirectory, varsFilename)
  const readStream = fs.createReadStream(varsFile)
  const readInterface = readline.createInterface(readStream)

  const generate = (res: () => void) => {
    readInterface
      .on("line", (line) => {
        if ( line.includes("=") ) {
          const value = line.split("=")[1]

          vars.push({
            Name: line.split("=")[0],
            Value: (value.length
                ? ( AssertNumeric(value) ? Number(value) : String(value) )
                : null
              ),
          })
        }
      })
      .on("close", () => {
        const webVarsStr = vars
          .sort((prev: IVarObj, next: IVarObj) => {
            return prev.Name < next.Name ? -1 : 1
          })
          .filter( (v) => publicVarNames.includes(v.Name) )
          .map((v) => {
            const val = typeof v.Value === typeof "" ? `"${v.Value}"` : String(v.Value)
            return `	${v.Name}: ${val},`
          })
          .join("\n")

        const content = GEN_TPL.replace("%s", webVarsStr)
        const genFile = path.resolve(outputDirectory, GEN_FILE)
        const writeStream = fs.createWriteStream(genFile)
        writeStream.write(content)
        writeStream.close()
        res()
      })
  }

  return new Promise(generate)
}

export const genExportConsts = (objs: IExportObj[]): string => {
  let exportStr = ""

  for (const obj of objs) {
    const objStr = obj.vars
      .sort((prev: IVarObj, next: IVarObj) => {
        return prev.Name < next.Name ? -1 : 1
      })
      .map((v) => {
        const val = typeof v.Value === typeof "" ? `"${v.Value}"` : String(v.Value)
        return `	${v.Name}: ${val},`
      })
      .join("\n")

    exportStr += GEN_CONST_TPL.replace("%s1", obj.name).replace("%s2", objStr).replace("%s3", obj.asType)
  }

  return exportStr
}

export const genBaseEntityNames = (outputDirectory: string): void => {
  const func = () => {}
  const objs: IExportObj[] = []

  for (const i in BaseBos) {
    const clss = (BaseBos as any)[i] as IBaseBoFactory<IBaseBo>

    if ( typeof clss !== typeof func || !(clss.prototype instanceof BaseBos.default) ) {
      continue
    }

    objs.push({
      // We are using a type reference so we detect the usage in our IDE, nevertheless (hopefuly) exclude the actual code while (browser) .js packing.
      asType: `as IPropsNames<BaseBos.${clss.name}>`,
      name: clss.name,
      vars: Object
          .entries( BaseBos.default.getPropNames(clss) )
          .map(([prop, val]) => {
            return {
              Name: prop,
              Value: val,
            }
          }),
    })
  }

  const exportedConsts = genExportConsts(objs)
  const fileContent = BASEBOS_NAMES_FILE_TPL.replace("%CONSTANTS", exportedConsts)

  const genFile = path.resolve(outputDirectory, BASEENTITY_NAMES_FILENAME)
  const writeStream = fs.createWriteStream(genFile)
  writeStream.write(fileContent)
  writeStream.close()
}

export default genConfigVars
