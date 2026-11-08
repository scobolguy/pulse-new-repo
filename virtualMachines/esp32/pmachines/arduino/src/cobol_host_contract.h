#pragma once

#include "scalar_runtime.h"

#ifndef PULSE_COBOL_HOST_LIBRARY
#define PULSE_COBOL_HOST_LIBRARY 1
#endif

namespace pmachine::rtl {
namespace detail {

using A = ArgKind;
using R = ResultKind;

enum BindingId {
    B_STRING_LOWER, B_STRING_UPPER, B_STRING_LENGTH, B_STRING_COMPARE, B_STRING_INDEX, B_STRING_SLICE,
    B_COBOL_CHAR, B_COBOL_ORD, B_DATE_CURRENT, B_DATE_ACCEPT,
    B_ACOS, B_ASIN, B_ATAN, B_COS, B_SIN, B_TAN, B_LOG, B_LOG10, B_SQRT, B_FACTORIAL, B_FLOOR, B_TRUNC,
    B_MOD, B_REM,
    B_MEAN, B_MEDIAN, B_MIDRANGE, B_RANGE, B_SUM, B_VARIANCE, B_STANDARD_DEVIATION,
    B_NUMVAL, B_NUMVAL_C, B_PRESENT_VALUE, B_NUMVAL_C_CURRENCY, B_ORD_MAX, B_ORD_MIN,
    B_INTEGER_OF_DATE, B_DATE_OF_INTEGER, B_INTEGER_OF_DAY, B_DAY_OF_INTEGER,
    B_ANNUITY, B_RANDOM, B_RANDOM_SEEDED,
    B_ISAM_OPEN, B_ISAM_READ, B_ISAM_READ_ALT, B_ISAM_READ_NEXT, B_ISAM_CURRENT_KEY, B_ISAM_COUNT,
    B_ISAM_START, B_ISAM_WRITE, B_ISAM_REWRITE, B_ISAM_DELETE, B_ISAM_STATUS, B_ISAM_CLOSE, B_ISAM_CLOSE_LOCK,
    B_COUNT
};

inline constexpr BindingSpec BINDINGS[B_COUNT] = {
    {"host.string_lower", 1, {A::String}, R::String},
    {"host.string_upper", 1, {A::String}, R::String},
    {"host.string_length", 1, {A::String}, R::Integer},
    {"host.string_compare", 2, {A::String, A::String}, R::Integer},
    {"host.string_index", 2, {A::String, A::String}, R::Integer},
    {"host.string_slice", 3, {A::String, A::Integer, A::Integer}, R::String},
    {"host.cobol_char", 1, {A::Number}, R::String},
    {"host.cobol_ord", 1, {A::String}, R::Integer},
    {"host.date_current", 0, {}, R::String},
    {"host.date_accept", 1, {A::String}, R::String},
    {"host.math_acos", 1, {A::Number}, R::Decimal},
    {"host.math_asin", 1, {A::Number}, R::Decimal},
    {"host.math_atan", 1, {A::Number}, R::Decimal},
    {"host.math_cos", 1, {A::Number}, R::Decimal},
    {"host.math_sin", 1, {A::Number}, R::Decimal},
    {"host.math_tan", 1, {A::Number}, R::Decimal},
    {"host.math_log", 1, {A::Number}, R::Decimal},
    {"host.math_log10", 1, {A::Number}, R::Decimal},
    {"host.math_sqrt", 1, {A::Number}, R::Decimal},
    {"host.math_factorial", 1, {A::Number}, R::Decimal},
    {"host.math_floor", 1, {A::Number}, R::Decimal},
    {"host.math_trunc", 1, {A::Number}, R::Decimal},
    {"host.math_mod", 2, {A::Number, A::Number}, R::Decimal},
    {"host.math_rem", 2, {A::Number, A::Number}, R::Decimal},
    {"host.math_mean", 1, {A::String}, R::Decimal},
    {"host.math_median", 1, {A::String}, R::Decimal},
    {"host.math_midrange", 1, {A::String}, R::Decimal},
    {"host.math_range", 1, {A::String}, R::Decimal},
    {"host.math_sum", 1, {A::String}, R::Decimal},
    {"host.math_variance", 1, {A::String}, R::Decimal},
    {"host.math_standard_deviation", 1, {A::String}, R::Decimal},
    {"host.math_numval", 1, {A::String}, R::Decimal},
    {"host.math_numval_c", 1, {A::String}, R::Decimal},
    {"host.math_present_value", 1, {A::String}, R::Decimal},
    {"host.math_numval_c_currency", 2, {A::String, A::String}, R::Decimal},
    {"host.math_ord_max", 1, {A::String}, R::Integer},
    {"host.math_ord_min", 1, {A::String}, R::Integer},
    {"host.math_integer_of_date", 1, {A::Number}, R::Integer},
    {"host.math_date_of_integer", 1, {A::Number}, R::Integer},
    {"host.math_integer_of_day", 1, {A::Number}, R::Integer},
    {"host.math_day_of_integer", 1, {A::Number}, R::Integer},
    {"host.math_annuity", 2, {A::Number, A::Number}, R::Decimal},
    {"host.math_random", 0, {}, R::Decimal},
    {"host.math_random_seeded", 1, {A::Number}, R::Decimal},
    {"host.isam_open", 4, {A::String, A::String, A::String, A::String}, R::Integer},
    {"host.isam_read", 2, {A::Integer, A::String}, R::String},
    {"host.isam_read_alt", 3, {A::Integer, A::String, A::String}, R::String},
    {"host.isam_read_next", 1, {A::Integer}, R::String},
    {"host.isam_current_key", 1, {A::Integer}, R::String},
    {"host.isam_count", 1, {A::Integer}, R::Integer},
    {"host.isam_start", 3, {A::Integer, A::String, A::String}, R::Integer},
    {"host.isam_write", 3, {A::Integer, A::String, A::String}, R::Integer},
    {"host.isam_rewrite", 3, {A::Integer, A::String, A::String}, R::Integer},
    {"host.isam_delete", 2, {A::Integer, A::String}, R::Integer},
    {"host.isam_status", 1, {A::Integer}, R::String},
    {"host.isam_close", 1, {A::Integer}, R::Integer},
    {"host.isam_close_lock", 1, {A::Integer}, R::Integer},
};

BindingValue callCobolHostLibrary(int id, const std::vector<BindingValue>& args, BindingContext& context);

}  // namespace detail
}  // namespace pmachine::rtl
