const { Project, SyntaxKind } = require("ts-morph");
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths([
    "src/index.ts",
    "src/routes/api.ts",
    "src/routes/admin.ts"
]);

const files = project.getSourceFiles();

files.forEach(sourceFile => {
    let callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    let toReplace = [];

    for (const callExpr of callExprs) {
        const propAccess = callExpr.getExpressionIfKind(SyntaxKind.PropertyAccessExpression);
        if (!propAccess) continue;

        const methodName = propAccess.getName();
        if (!["get", "all", "run"].includes(methodName)) continue;

        const expr = propAccess.getExpressionIfKind(SyntaxKind.CallExpression);
        if (!expr) continue;

        const dbPropAccess = expr.getExpressionIfKind(SyntaxKind.PropertyAccessExpression);
        if (!dbPropAccess || dbPropAccess.getName() !== "prepare") continue;

        const parent = callExpr.getParent();
        if (parent.getKind() === SyntaxKind.AwaitExpression) continue;

        toReplace.push(callExpr);
    }

    // Sort in reverse order by start position to avoid shifting AST offsets
    toReplace.sort((a, b) => b.getStart() - a.getStart());

    if (toReplace.length > 0) {
        for (const callExpr of toReplace) {
            callExpr.replaceWithText(`await ${callExpr.getText()}`);
        }
        
        // Fix async functions
        const awaits = sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression);
        for (const awaitExpr of awaits) {
            let p = awaitExpr.getParent();
            while (p && ![SyntaxKind.ArrowFunction, SyntaxKind.FunctionDeclaration, SyntaxKind.FunctionExpression].includes(p.getKind())) {
                p = p.getParent();
            }
            if (p) {
                // Typecast correctly based on kind
                if (p.isKind(SyntaxKind.ArrowFunction) || p.isKind(SyntaxKind.FunctionDeclaration) || p.isKind(SyntaxKind.FunctionExpression)) {
                    if (!p.isAsync()) {
                        p.setIsAsync(true);
                    }
                }
            }
        }
        
        sourceFile.saveSync();
        console.log(`Saved ${sourceFile.getFilePath()}`);
    }
});
