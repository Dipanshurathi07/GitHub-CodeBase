const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

/**
 * Code string ko AST me convert karta hai
 */
function createAST(code, filePath = "") {
  if (typeof code !== "string") {
    console.error("createAST: code must be a string");
    return null;
  }

  try {
    return parser.parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
      errorRecovery: true, // chhoti errors pe bhi partial AST return karega
    });
  } catch (error) {
    console.error(`createAST parse error (${filePath}):`, error.message || error);
    return null;
  }
}

/**
 * AST se imports, functions, classes, exports nikalta hai
 */
function extractMetadata(ast,filePath = "",code) {
  const metadata = {
    rawContent : code,
    file : filePath,
    imports: [],
    functions: [],
    classes: [],
    exports: [],
  };

  if (!ast) return metadata; // safety: agar parse fail hua tha

  traverse(ast, {
  // ---------------- ES Module Imports ----------------
  ImportDeclaration(path) {
    metadata.imports.push({
      source: path.node.source.value,
      type: "ESModule",
      startLine: path.node.loc.start.line,
      endLine: path.node.loc.end.line,
    });
  },

  // ---------------- Normal Functions ----------------
  FunctionDeclaration(path) {
    metadata.functions.push({
      name: path.node.id?.name,
      async: path.node.async,
      startLine: path.node.loc.start.line,
      endLine: path.node.loc.end.line,
    });
  },

  // ---------------- Variables (require + Arrow Functions) ----------------
  VariableDeclarator(path) {
    const init = path.node.init;

    // CommonJS require()
    if (
      init &&
      init.type === "CallExpression" &&
      init.callee.name === "require"
    ) {
      metadata.imports.push({
        source: init.arguments[0]?.value,
        type: "CommonJS",

        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line,
      });
    }

    // Arrow Function
    if (init && init.type === "ArrowFunctionExpression") {
      metadata.functions.push({
        name: path.node.id?.name,
        async: init.async,

        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line,
      });
    }
  },

  // ---------------- Classes ----------------
  ClassDeclaration(path) {
    const methods = [];

    path.node.body.body.forEach((member) => {
      if (member.type === "ClassMethod") {
        methods.push(member.key.name);
      }
    });

    metadata.classes.push({
      name: path.node.id?.name,
      methods,
      startLine: path.node.loc.start.line,
      endLine: path.node.loc.end.line,
    });
  },

  // ---------------- ES Module Exports ----------------
  ExportNamedDeclaration(path) {
    const decl = path.node.declaration;

    if (decl?.id) {
      metadata.exports.push({
        name: decl.id.name,
        type: "named",

        startLine: path.node.loc.start.line,
        endLine: path.node.loc.end.line,
      });
    } else if (decl?.declarations) {
      decl.declarations.forEach((d) => {
        if (d.id?.name) {
          metadata.exports.push({
            name: d.id.name,
            type: "named",
    
            startLine: path.node.loc.start.line,
            endLine: path.node.loc.end.line,
          });
        }
      });
    }
  },

  ExportDefaultDeclaration(path) {
    metadata.exports.push({
      name: "default",
      type: "default",
      startLine: path.node.loc.start.line,
      endLine: path.node.loc.end.line,
    });
  },

  // ---------------- CommonJS Exports ----------------
  AssignmentExpression(path) {
    const left = path.node.left;

    // module.exports = { a, b }
    if (
      left.type === "MemberExpression" &&
      left.object.name === "module" &&
      left.property.name === "exports"
    ) {
      const right = path.node.right;

      if (right.type === "ObjectExpression") {
        right.properties.forEach((prop) => {
          if (prop.key?.name) {
            metadata.exports.push({
              name: prop.key.name,
              type: "CommonJS",
      
              startLine: path.node.loc.start.line,
              endLine: path.node.loc.end.line,
            });
          }
        });
      } else if (right.type === "Identifier") {
        metadata.exports.push({
          name: right.name,
          type: "CommonJS",
  
          startLine: path.node.loc.start.line,
          endLine: path.node.loc.end.line,
        });
      }
    }

    // module.exports.foo = ...
    // exports.foo = ...
    if (
      left.type === "MemberExpression" &&
      (left.object.name === "exports" ||
        (left.object.type === "MemberExpression" &&
          left.object.object?.name === "module" &&
          left.object.property?.name === "exports"))
    ) {
      if (left.property?.name) {
        metadata.exports.push({
          name: left.property.name,
          type: "CommonJS",
  
          startLine: path.node.loc.start.line,
          endLine: path.node.loc.end.line,
        });
      }
    }
  },
});
return metadata;
}

module.exports = { createAST, extractMetadata };