import os
from compiler.preprocessor import Preprocessor

def test_preprocessor():
    test_file = os.path.join(os.path.dirname(__file__), 'test_preprocessor.pulse0')
    with open(test_file) as f:
        lines = f.readlines()
    pre = Preprocessor()
    out = pre.preprocess(lines)
    print('\n'.join(out))

if __name__ == '__main__':
    test_preprocessor()
