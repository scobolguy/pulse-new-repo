#pragma once

#include "pmachine_value.h"
#include <string>
#include <vector>

namespace pmachine {

struct FortranScalar {
    Value value;
    std::string text;
    bool managedString = false;

    FortranScalar() = default;
    explicit FortranScalar(Value number) : value(number) {}
    explicit FortranScalar(const std::string& string) : value(Value::makeString(0)), text(string) {}
    static FortranScalar fromManagedString(Value reference, const std::string& text) {
        FortranScalar scalar(text);
        scalar.value = reference;
        scalar.managedString = true;
        return scalar;
    }
    bool isString() const { return value.isString(); }
};

// Arguments/results own their text; no string-pool pointers survive a VM safe point.
bool executeFortranNumeric(const std::string& symbol, const std::vector<FortranScalar>& args,
                          std::vector<FortranScalar>& results, std::string& error);

}
