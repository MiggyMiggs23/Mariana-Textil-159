// Narrow lexical audit, not a PostgreSQL parser. Dollar-quoted function bodies
// are intentionally scanned; comments and SQL string/identifier literals aren't.
export function auditIfCases(sql) {
  const tokens=/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|\\.|[^'])*'|"(?:\"\"|[^"])*"|\b[A-Za-z_][A-Za-z_0-9]*\b|[()]/gi;
  let depth=0,header=null,previous="";
  const cases=[];
  for(const match of sql.matchAll(tokens)) {
    const raw=match[0],token=raw.toUpperCase();
    if(raw.startsWith("--")||raw.startsWith("/*")||raw.startsWith("'")||raw.startsWith('"'))continue;
    if(token==="(")depth++;
    else if(token===")")depth--;
    else if((token==="IF"&&previous!=="END")||token==="ELSIF")header={depth};
    else if(token==="CASE")cases.push({
      line:sql.slice(0,match.index).split("\n").length,
      inIfCondition:header!==null,parenthesisDepth:depth,
      safe:header===null||depth>header.depth,
    });
    else if(token==="THEN"&&header&&depth===header.depth)header=null;
    previous=token;
  }
  return cases;
}