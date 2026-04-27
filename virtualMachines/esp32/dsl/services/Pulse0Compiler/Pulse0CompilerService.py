
from flask import Flask, request, jsonify
from compiler import parser_driver
from compiler.codegen import CodeGenerator

app = Flask(__name__)

@app.route('/compile', methods=['POST'])
def compile_pulse0():
    source = request.json.get('source', '')
    if not source:
        return jsonify({'error': 'No source code provided'}), 400
    # Parse source to AST
    ast = parser_driver.parse_pulse0(source)
    # Generate PCODE
    codegen = CodeGenerator()
    pcode = codegen.generate(ast)
    return jsonify({'pcode': pcode})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
