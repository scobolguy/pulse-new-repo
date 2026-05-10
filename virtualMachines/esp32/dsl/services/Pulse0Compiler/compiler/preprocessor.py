import os
import re

class Preprocessor:
    def __init__(self):
        self.macros = {}
        self.defined = set()
        self.structs = {}
        self.output = []
        self.cond_stack = []
        self.include_paths = ['.']

    def preprocess(self, lines, filename=None):
        i = 0
        while i < len(lines):
            line = lines[i].rstrip('\n')
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):  # skip comments
                i += 1
                continue
            if stripped.startswith('.include'):
                fname = stripped.split(None, 1)[1].strip('"')
                for path in self.include_paths:
                    full = os.path.join(path, fname)
                    if os.path.exists(full):
                        with open(full) as f:
                            self.preprocess(f.readlines(), full)
                        break
                i += 1
                continue
            if stripped.startswith('.define'):
                sym = stripped.split(None, 1)[1]
                self.defined.add(sym)
                i += 1
                continue
            if stripped.startswith('.undef'):
                sym = stripped.split(None, 1)[1]
                self.defined.discard(sym)
                i += 1
                continue
            if stripped.startswith('.ifdef'):
                sym = stripped.split(None, 1)[1]
                self.cond_stack.append(sym in self.defined)
                i += 1
                continue
            if stripped.startswith('.ifndef'):
                sym = stripped.split(None, 1)[1]
                self.cond_stack.append(sym not in self.defined)
                i += 1
                continue
            if stripped.startswith('.else'):
                if self.cond_stack:
                    self.cond_stack[-1] = not self.cond_stack[-1]
                i += 1
                continue
            if stripped.startswith('.endif'):
                if self.cond_stack:
                    self.cond_stack.pop()
                i += 1
                continue
            if self.cond_stack and not all(self.cond_stack):
                i += 1
                continue
            if stripped.startswith('.macro'):
                macro_name, *params = stripped.split()[1:]
                macro_lines = []
                i += 1
                while i < len(lines):
                    l = lines[i].strip()
                    if l.startswith('.endmacro'):
                        break
                    macro_lines.append(lines[i])
                    i += 1
                self.macros[macro_name] = (params, macro_lines)
                i += 1
                continue
            if stripped.startswith('.struct'):
                struct_name = stripped.split()[1]
                fields = []
                i += 1
                while i < len(lines):
                    l = lines[i].strip()
                    if l.startswith('.endstruct'):
                        break
                    if ':' in l:
                        fname, ftype = [x.strip() for x in l.split(':', 1)]
                        fields.append((fname, ftype))
                    i += 1
                self.structs[struct_name] = fields
                i += 1
                continue
            # Macro expansion
            tokens = stripped.split()
            if tokens and tokens[0] in self.macros:
                params, macro_lines = self.macros[tokens[0]]
                argmap = dict(zip(params, tokens[1:]))
                for mline in macro_lines:
                    for p, v in argmap.items():
                        mline = mline.replace(p, v)
                    self.output.append(mline.rstrip('\n'))
                i += 1
                continue
            self.output.append(line)
            i += 1
        return self.output

# Example usage:
# pre = Preprocessor()
# with open('test_program.pulse0') as f:
#     lines = f.readlines()
# out = pre.preprocess(lines)
# print('\n'.join(out))
