#pragma once

namespace pmachine {
static const char SLOT_SCHEDULER_PCODE[] = R"pulse_scheduler(
JMP MAIN
CS_METHOD_0:
CALL_EXT host.scheduler_operation 0
STORE_NAME CS_V0
LOAD_NAME CS_V0
PUSH_STR "status"
STREQ
JZ CS_ELSE_9
CALL CS_METHOD_5 0
STORE_NAME CS_TMP0
RET
JMP CS_IF_END_10
CS_ELSE_9:
CS_IF_END_10:
LOAD_NAME CS_V0
PUSH_STR "restore"
STREQ
JZ CS_ELSE_11
CALL CS_METHOD_8 0
STORE_NAME CS_TMP1
RET
JMP CS_IF_END_12
CS_ELSE_11:
CS_IF_END_12:
CALL_EXT host.scheduler_request 0
STORE_NAME CS_V1
LOAD_NAME CS_V1
CALL_EXT host.json_kind 1
PUSH_STR "object"
STRNEQ
JZ CS_ELSE_13
PUSH_INT 400
PUSH_STR "Expected a JSON request object"
CALL CS_METHOD_1 2
STORE_NAME CS_TMP2
RET
JMP CS_IF_END_14
CS_ELSE_13:
CS_IF_END_14:
LOAD_NAME CS_V0
PUSH_STR "load"
STREQ
JZ CS_ELSE_15
LOAD_NAME CS_V1
CALL CS_METHOD_6 1
STORE_NAME CS_TMP3
RET
JMP CS_IF_END_16
CS_ELSE_15:
CS_IF_END_16:
LOAD_NAME CS_V0
PUSH_STR "unload"
STREQ
JZ CS_ELSE_17
LOAD_NAME CS_V1
CALL CS_METHOD_7 1
STORE_NAME CS_TMP4
RET
JMP CS_IF_END_18
CS_ELSE_17:
CS_IF_END_18:
PUSH_INT 400
PUSH_STR "Invalid scheduler operation"
CALL CS_METHOD_1 2
STORE_NAME CS_TMP5
RET
CS_METHOD_1:
PUSH_STR "{}"
PUSH_STR "version"
PUSH_INT 1
CALL_EXT host.json_set 3
STORE_NAME CS_V2
LOAD_NAME CS_V2
PUSH_STR "error"
LOAD_NAME CS_V1
CALL_EXT host.json_set 3
STORE_NAME CS_V2
LOAD_NAME CS_V2
STORE_NAME CS_TMP0
LOAD_NAME CS_V0
LOAD_NAME CS_V2
CALL_EXT host.scheduler_respond 2
RET
RET
CS_METHOD_2:
LOAD_NAME CS_V0
PUSH_INT 0
EQ
JZ CS_ELSE_19
PUSH_INT 403
PUSH_STR "Slot 0 is reserved for the scheduler"
CALL CS_METHOD_1 2
STORE_NAME CS_TMP0
PUSH_INT 0
RET
JMP CS_IF_END_20
CS_ELSE_19:
CS_IF_END_20:
LOAD_NAME CS_V0
PUSH_INT 1
LT
NOT
JZ CS_LOGICAL_23
LOAD_NAME CS_V0
PUSH_INT 16
GT
JMP CS_LOGICAL_END_24
CS_LOGICAL_23:
PUSH_INT 1
CS_LOGICAL_END_24:
JZ CS_ELSE_21
PUSH_INT 400
PUSH_STR "Slot must be between 1 and 16"
CALL CS_METHOD_1 2
STORE_NAME CS_TMP1
PUSH_INT 0
RET
JMP CS_IF_END_22
CS_ELSE_21:
CS_IF_END_22:
PUSH_INT 1
RET
RET
CS_METHOD_3:
LOAD_NAME CS_V0
PUSH_STR "kind"
CALL_EXT host.json_text 2
STORE_NAME CS_V1
LOAD_NAME CS_V1
PUSH_STR "service"
STREQ
NOT
JZ CS_LOGICAL_27
LOAD_NAME CS_V1
PUSH_STR "daemon"
STREQ
JMP CS_LOGICAL_END_28
CS_LOGICAL_27:
PUSH_INT 1
CS_LOGICAL_END_28:
JZ CS_ELSE_25
PUSH_INT 1
RET
JMP CS_IF_END_26
CS_ELSE_25:
CS_IF_END_26:
PUSH_INT 0
RET
RET
CS_METHOD_4:
PUSH_STR "[]"
STORE_NAME CS_V1
PUSH_INT 1
STORE_NAME CS_V2
CS_LOOP_29:
LOAD_NAME CS_V2
PUSH_INT 16
LE
JZ CS_LOOP_END_31
LOAD_NAME CS_V2
CALL_EXT host.scheduler_slot 1
STORE_NAME CS_V3
LOAD_NAME CS_V2
LOAD_NAME CS_V0
NEQ
JZ CS_LOGICAL_34
LOAD_NAME CS_V3
PUSH_STR "{}"
STRNEQ
JMP CS_LOGICAL_END_35
CS_LOGICAL_34:
PUSH_INT 0
CS_LOGICAL_END_35:
JZ CS_ELSE_32
LOAD_NAME CS_V3
CALL CS_METHOD_3 1
PUSH_INT 1
EQ
JZ CS_ELSE_36
LOAD_NAME CS_V1
LOAD_NAME CS_V3
CALL_EXT host.json_array_append 2
STORE_NAME CS_V1
LOAD_NAME CS_V1
STORE_NAME CS_TMP0
JMP CS_IF_END_37
CS_ELSE_36:
CS_IF_END_37:
JMP CS_IF_END_33
CS_ELSE_32:
CS_IF_END_33:
LOAD_NAME CS_V2
PUSH_INT 1
ADD
STORE_NAME CS_V2
LOAD_NAME CS_V2
STORE_NAME CS_TMP1
CS_CONTINUE_30:
JMP CS_LOOP_29
CS_LOOP_END_31:
PUSH_STR "{\"version\":1}"
PUSH_STR "slots"
LOAD_NAME CS_V1
CALL_EXT host.json_embed 3
RET
RET
CS_METHOD_5:
PUSH_STR "[{\"slot\":0,\"id\":\"pulse-slot-scheduler\",\"kind\":\"daemon\",\"protected\":true,\"state\":\"running\"}]"
STORE_NAME CS_V0
PUSH_INT 1
STORE_NAME CS_V1
CS_LOOP_38:
LOAD_NAME CS_V1
PUSH_INT 16
LE
JZ CS_LOOP_END_40
LOAD_NAME CS_V1
CALL_EXT host.scheduler_slot 1
STORE_NAME CS_V2
LOAD_NAME CS_V2
PUSH_STR "{}"
STREQ
JZ CS_ELSE_41
PUSH_STR "{\"state\":\"empty\"}"
PUSH_STR "slot"
LOAD_NAME CS_V1
CALL_EXT host.json_set 3
STORE_NAME CS_V2
LOAD_NAME CS_V2
STORE_NAME CS_TMP0
JMP CS_IF_END_42
CS_ELSE_41:
LOAD_NAME CS_V2
PUSH_STR "state"
PUSH_STR "running"
CALL_EXT host.json_set 3
STORE_NAME CS_V2
LOAD_NAME CS_V2
STORE_NAME CS_TMP1
CS_IF_END_42:
LOAD_NAME CS_V0
LOAD_NAME CS_V2
CALL_EXT host.json_array_append 2
STORE_NAME CS_V0
LOAD_NAME CS_V0
STORE_NAME CS_TMP2
LOAD_NAME CS_V1
PUSH_INT 1
ADD
STORE_NAME CS_V1
LOAD_NAME CS_V1
STORE_NAME CS_TMP3
CS_CONTINUE_39:
JMP CS_LOOP_38
CS_LOOP_END_40:
PUSH_INT 200
PUSH_STR "{\"version\":1}"
PUSH_STR "slots"
LOAD_NAME CS_V0
CALL_EXT host.json_embed 3
CALL_EXT host.scheduler_respond 2
RET
RET
CS_METHOD_6:
PUSH_INT -1
STORE_NAME CS_V1
LOAD_NAME CS_V0
PUSH_STR "slot"
CALL_EXT host.json_has 2
PUSH_INT 1
EQ
JZ CS_ELSE_43
LOAD_NAME CS_V0
PUSH_STR "slot"
CALL_EXT host.json_integer 2
STORE_NAME CS_V1
LOAD_NAME CS_V1
STORE_NAME CS_TMP0
LOAD_NAME CS_V1
CALL CS_METHOD_2 1
PUSH_INT 0
EQ
JZ CS_ELSE_45
PUSH_INT 0
RET
JMP CS_IF_END_46
CS_ELSE_45:
CS_IF_END_46:
JMP CS_IF_END_44
CS_ELSE_43:
CS_IF_END_44:
LOAD_NAME CS_V0
PUSH_STR "manifestPath"
CALL_EXT host.json_text 2
STORE_NAME CS_V2
LOAD_NAME CS_V2
CALL_EXT system.string.length 1
PUSH_INT 0
EQ
JZ CS_ELSE_47
PUSH_INT 400
PUSH_STR "manifestPath is required"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_48
CS_ELSE_47:
CS_IF_END_48:
LOAD_NAME CS_V2
CALL_EXT host.scheduler_read 1
STORE_NAME CS_V3
LOAD_NAME CS_V3
CALL_EXT host.json_kind 1
PUSH_STR "object"
STRNEQ
JZ CS_ELSE_49
PUSH_INT 400
PUSH_STR "Expected a bundle manifest object"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_50
CS_ELSE_49:
CS_IF_END_50:
LOAD_NAME CS_V3
PUSH_STR "type"
CALL_EXT host.json_text 2
STORE_NAME CS_V4
LOAD_NAME CS_V4
PUSH_STR "service"
STRNEQ
JZ CS_LOGICAL_55
LOAD_NAME CS_V4
PUSH_STR "daemon"
STRNEQ
JMP CS_LOGICAL_END_56
CS_LOGICAL_55:
PUSH_INT 0
CS_LOGICAL_END_56:
JZ CS_LOGICAL_53
LOAD_NAME CS_V4
PUSH_STR "transient"
STRNEQ
JMP CS_LOGICAL_END_54
CS_LOGICAL_53:
PUSH_INT 0
CS_LOGICAL_END_54:
JZ CS_ELSE_51
PUSH_INT 400
PUSH_STR "Expected a service, daemon or transient program"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_52
CS_ELSE_51:
CS_IF_END_52:
PUSH_INT 1
STORE_NAME CS_V5
PUSH_INT -1
STORE_NAME CS_V6
CS_LOOP_57:
LOAD_NAME CS_V5
PUSH_INT 16
LE
JZ CS_LOOP_END_59
LOAD_NAME CS_V5
CALL_EXT host.scheduler_slot 1
STORE_NAME CS_V7
LOAD_NAME CS_V7
PUSH_STR "{}"
STREQ
JZ CS_ELSE_60
LOAD_NAME CS_V6
PUSH_INT -1
EQ
JZ CS_ELSE_62
LOAD_NAME CS_V5
STORE_NAME CS_V6
LOAD_NAME CS_V6
STORE_NAME CS_TMP1
JMP CS_IF_END_63
CS_ELSE_62:
CS_IF_END_63:
JMP CS_IF_END_61
CS_ELSE_60:
LOAD_NAME CS_V7
PUSH_STR "manifestPath"
CALL_EXT host.json_text 2
LOAD_NAME CS_V2
STREQ
JZ CS_ELSE_64
PUSH_INT 409
PUSH_STR "Program is already loaded"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_65
CS_ELSE_64:
CS_IF_END_65:
CS_IF_END_61:
LOAD_NAME CS_V5
PUSH_INT 1
ADD
STORE_NAME CS_V5
LOAD_NAME CS_V5
STORE_NAME CS_TMP2
CS_CONTINUE_58:
JMP CS_LOOP_57
CS_LOOP_END_59:
LOAD_NAME CS_V1
PUSH_INT -1
EQ
JZ CS_ELSE_66
LOAD_NAME CS_V6
STORE_NAME CS_V1
LOAD_NAME CS_V1
STORE_NAME CS_TMP3
JMP CS_IF_END_67
CS_ELSE_66:
CS_IF_END_67:
LOAD_NAME CS_V1
PUSH_INT -1
EQ
JZ CS_ELSE_68
PUSH_INT 409
PUSH_STR "All program slots are occupied"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_69
CS_ELSE_68:
CS_IF_END_69:
LOAD_NAME CS_V1
CALL_EXT host.scheduler_slot 1
PUSH_STR "{}"
STRNEQ
JZ CS_ELSE_70
PUSH_INT 409
PUSH_STR "Slot is already occupied"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_71
CS_ELSE_70:
CS_IF_END_71:
PUSH_STR "{}"
PUSH_STR "slot"
LOAD_NAME CS_V1
CALL_EXT host.json_set 3
STORE_NAME CS_V8
LOAD_NAME CS_V8
PUSH_STR "manifestPath"
LOAD_NAME CS_V2
CALL_EXT host.json_set 3
STORE_NAME CS_V8
LOAD_NAME CS_V8
STORE_NAME CS_TMP4
LOAD_NAME CS_V8
PUSH_STR "kind"
LOAD_NAME CS_V4
CALL_EXT host.json_set 3
STORE_NAME CS_V8
LOAD_NAME CS_V8
STORE_NAME CS_TMP5
LOAD_NAME CS_V8
PUSH_STR "manifest"
LOAD_NAME CS_V3
CALL_EXT host.json_embed 3
STORE_NAME CS_V8
LOAD_NAME CS_V8
STORE_NAME CS_TMP6
PUSH_STR ""
STORE_NAME CS_V9
PUSH_STR ""
STORE_NAME CS_V10
LOAD_NAME CS_V4
PUSH_STR "transient"
STRNEQ
JZ CS_ELSE_72
PUSH_INT -1
CALL CS_METHOD_4 1
STORE_NAME CS_V9
LOAD_NAME CS_V9
STORE_NAME CS_TMP7
LOAD_NAME CS_V9
PUSH_STR "slots"
CALL_EXT host.json_value 2
LOAD_NAME CS_V8
CALL_EXT host.json_array_append 2
STORE_NAME CS_V11
PUSH_STR "{\"version\":1}"
PUSH_STR "slots"
LOAD_NAME CS_V11
CALL_EXT host.json_embed 3
STORE_NAME CS_V10
LOAD_NAME CS_V10
STORE_NAME CS_TMP8
JMP CS_IF_END_73
CS_ELSE_72:
CS_IF_END_73:
LOAD_NAME CS_V1
LOAD_NAME CS_V8
CALL_EXT host.scheduler_stage 2
STORE_NAME CS_V12
LOAD_NAME CS_V12
PUSH_INT 200
NEQ
JZ CS_ELSE_74
LOAD_NAME CS_V12
CALL_EXT host.scheduler_error 0
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_75
CS_ELSE_74:
CS_IF_END_75:
LOAD_NAME CS_V4
PUSH_STR "transient"
STRNEQ
JZ CS_ELSE_76
LOAD_NAME CS_V10
CALL_EXT host.scheduler_commit 1
PUSH_INT 1
NEQ
JZ CS_ELSE_78
CALL_EXT host.scheduler_error 0
STORE_NAME CS_V13
LOAD_NAME CS_V1
CALL_EXT host.scheduler_remove 1
PUSH_INT 200
NEQ
JZ CS_ELSE_80
PUSH_INT 503
PUSH_STR "Persistence and staging cleanup failed"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_81
CS_ELSE_80:
CS_IF_END_81:
PUSH_INT 503
LOAD_NAME CS_V13
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_79
CS_ELSE_78:
CS_IF_END_79:
JMP CS_IF_END_77
CS_ELSE_76:
CS_IF_END_77:
LOAD_NAME CS_V1
CALL_EXT host.scheduler_activate 1
STORE_NAME CS_V14
LOAD_NAME CS_V14
PUSH_INT 200
NEQ
JZ CS_ELSE_82
CALL_EXT host.scheduler_error 0
STORE_NAME CS_V15
LOAD_NAME CS_V1
CALL_EXT host.scheduler_remove 1
PUSH_INT 200
NEQ
JZ CS_ELSE_84
PUSH_INT 503
PUSH_STR "Activation and staging cleanup failed"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_85
CS_ELSE_84:
CS_IF_END_85:
LOAD_NAME CS_V4
PUSH_STR "transient"
STRNEQ
JZ CS_ELSE_86
LOAD_NAME CS_V9
CALL_EXT host.scheduler_commit 1
PUSH_INT 1
NEQ
JZ CS_ELSE_88
PUSH_INT 503
PUSH_STR "Activation rollback could not be persisted"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_89
CS_ELSE_88:
CS_IF_END_89:
JMP CS_IF_END_87
CS_ELSE_86:
CS_IF_END_87:
LOAD_NAME CS_V14
LOAD_NAME CS_V15
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_83
CS_ELSE_82:
CS_IF_END_83:
PUSH_STR "{\"version\":1}"
PUSH_STR "slot"
LOAD_NAME CS_V1
CALL_EXT host.json_set 3
STORE_NAME CS_V16
LOAD_NAME CS_V16
PUSH_STR "manifestPath"
LOAD_NAME CS_V2
CALL_EXT host.json_set 3
STORE_NAME CS_V16
LOAD_NAME CS_V16
STORE_NAME CS_TMP9
LOAD_NAME CS_V16
PUSH_STR "kind"
LOAD_NAME CS_V4
CALL_EXT host.json_set 3
STORE_NAME CS_V16
LOAD_NAME CS_V16
STORE_NAME CS_TMP10
LOAD_NAME CS_V4
PUSH_STR "transient"
STREQ
JZ CS_ELSE_90
LOAD_NAME CS_V1
CALL_EXT host.scheduler_remove 1
PUSH_INT 200
NEQ
JZ CS_ELSE_92
PUSH_INT 503
PUSH_STR "Completed transient could not be released"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_93
CS_ELSE_92:
CS_IF_END_93:
LOAD_NAME CS_V16
PUSH_STR "state"
PUSH_STR "completed"
CALL_EXT host.json_set 3
STORE_NAME CS_V16
LOAD_NAME CS_V16
STORE_NAME CS_TMP11
JMP CS_IF_END_91
CS_ELSE_90:
LOAD_NAME CS_V16
PUSH_STR "state"
PUSH_STR "running"
CALL_EXT host.json_set 3
STORE_NAME CS_V16
LOAD_NAME CS_V16
STORE_NAME CS_TMP12
CS_IF_END_91:
PUSH_INT 201
LOAD_NAME CS_V16
CALL_EXT host.scheduler_respond 2
RET
RET
CS_METHOD_7:
LOAD_NAME CS_V0
PUSH_STR "slot"
CALL_EXT host.json_integer 2
STORE_NAME CS_V1
LOAD_NAME CS_V1
CALL CS_METHOD_2 1
PUSH_INT 0
EQ
JZ CS_ELSE_94
PUSH_INT 0
RET
JMP CS_IF_END_95
CS_ELSE_94:
CS_IF_END_95:
LOAD_NAME CS_V1
CALL_EXT host.scheduler_slot 1
STORE_NAME CS_V2
LOAD_NAME CS_V2
PUSH_STR "{}"
STREQ
JZ CS_ELSE_96
PUSH_INT 404
PUSH_STR "Slot is empty"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_97
CS_ELSE_96:
CS_IF_END_97:
PUSH_INT -1
CALL CS_METHOD_4 1
STORE_NAME CS_V3
LOAD_NAME CS_V2
CALL CS_METHOD_3 1
STORE_NAME CS_V4
LOAD_NAME CS_V4
PUSH_INT 1
EQ
JZ CS_ELSE_98
LOAD_NAME CS_V1
CALL CS_METHOD_4 1
CALL_EXT host.scheduler_commit 1
PUSH_INT 1
NEQ
JZ CS_ELSE_100
PUSH_INT 503
CALL_EXT host.scheduler_error 0
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_101
CS_ELSE_100:
CS_IF_END_101:
JMP CS_IF_END_99
CS_ELSE_98:
CS_IF_END_99:
LOAD_NAME CS_V1
CALL_EXT host.scheduler_remove 1
STORE_NAME CS_V5
LOAD_NAME CS_V5
PUSH_INT 200
NEQ
JZ CS_ELSE_102
CALL_EXT host.scheduler_error 0
STORE_NAME CS_V6
LOAD_NAME CS_V4
PUSH_INT 1
EQ
JZ CS_ELSE_104
LOAD_NAME CS_V3
CALL_EXT host.scheduler_commit 1
PUSH_INT 1
NEQ
JZ CS_ELSE_106
PUSH_INT 503
PUSH_STR "Unload rollback could not be persisted"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_107
CS_ELSE_106:
CS_IF_END_107:
JMP CS_IF_END_105
CS_ELSE_104:
CS_IF_END_105:
LOAD_NAME CS_V5
LOAD_NAME CS_V6
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_103
CS_ELSE_102:
CS_IF_END_103:
PUSH_STR "{\"version\":1,\"state\":\"empty\"}"
PUSH_STR "slot"
LOAD_NAME CS_V1
CALL_EXT host.json_set 3
STORE_NAME CS_V7
PUSH_INT 200
LOAD_NAME CS_V7
CALL_EXT host.scheduler_respond 2
RET
RET
CS_METHOD_8:
CALL_EXT host.scheduler_saved_state 0
STORE_NAME CS_V0
LOAD_NAME CS_V0
CALL_EXT host.json_kind 1
PUSH_STR "object"
STRNEQ
NOT
JZ CS_LOGICAL_110
LOAD_NAME CS_V0
PUSH_STR "version"
CALL_EXT host.json_integer 2
PUSH_INT 1
NEQ
JMP CS_LOGICAL_END_111
CS_LOGICAL_110:
PUSH_INT 1
CS_LOGICAL_END_111:
JZ CS_ELSE_108
PUSH_INT 503
PUSH_STR "Invalid scheduler state version"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_109
CS_ELSE_108:
CS_IF_END_109:
LOAD_NAME CS_V0
PUSH_STR "slots"
CALL_EXT host.json_value 2
STORE_NAME CS_V1
LOAD_NAME CS_V1
CALL_EXT host.json_kind 1
PUSH_STR "array"
STRNEQ
JZ CS_ELSE_112
PUSH_INT 503
PUSH_STR "Invalid saved slots"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_113
CS_ELSE_112:
CS_IF_END_113:
LOAD_NAME CS_V1
CALL_EXT host.json_array_count 1
STORE_NAME CS_V2
LOAD_NAME CS_V2
PUSH_INT 16
GT
JZ CS_ELSE_114
PUSH_INT 503
PUSH_STR "Too many saved slots"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_115
CS_ELSE_114:
CS_IF_END_115:
PUSH_INT 0
STORE_NAME CS_V3
PUSH_STR "[]"
STORE_NAME CS_V4
CS_LOOP_116:
LOAD_NAME CS_V3
LOAD_NAME CS_V2
LT
JZ CS_LOOP_END_118
LOAD_NAME CS_V1
LOAD_NAME CS_V3
CALL_EXT host.json_array_get 2
STORE_NAME CS_V5
LOAD_NAME CS_V5
PUSH_STR "slot"
CALL_EXT host.json_integer 2
STORE_NAME CS_V6
LOAD_NAME CS_V6
PUSH_INT 1
LT
NOT
JZ CS_LOGICAL_123
LOAD_NAME CS_V6
PUSH_INT 16
GT
JMP CS_LOGICAL_END_124
CS_LOGICAL_123:
PUSH_INT 1
CS_LOGICAL_END_124:
NOT
JZ CS_LOGICAL_121
LOAD_NAME CS_V5
CALL CS_METHOD_3 1
PUSH_INT 0
EQ
JMP CS_LOGICAL_END_122
CS_LOGICAL_121:
PUSH_INT 1
CS_LOGICAL_END_122:
JZ CS_ELSE_119
PUSH_INT 503
PUSH_STR "Invalid persistent slot descriptor"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_120
CS_ELSE_119:
CS_IF_END_120:
LOAD_NAME CS_V5
PUSH_STR "manifest"
CALL_EXT host.json_value 2
PUSH_STR "type"
CALL_EXT host.json_text 2
LOAD_NAME CS_V5
PUSH_STR "kind"
CALL_EXT host.json_text 2
STRNEQ
JZ CS_ELSE_125
PUSH_INT 503
PUSH_STR "Saved manifest kind mismatch"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_126
CS_ELSE_125:
CS_IF_END_126:
PUSH_INT 0
STORE_NAME CS_V7
CS_LOOP_127:
LOAD_NAME CS_V7
LOAD_NAME CS_V3
LT
JZ CS_LOOP_END_129
LOAD_NAME CS_V4
LOAD_NAME CS_V7
CALL_EXT host.json_array_get 2
STORE_NAME CS_V8
LOAD_NAME CS_V8
PUSH_STR "slot"
CALL_EXT host.json_integer 2
LOAD_NAME CS_V6
EQ
NOT
JZ CS_LOGICAL_132
LOAD_NAME CS_V8
PUSH_STR "manifestPath"
CALL_EXT host.json_text 2
LOAD_NAME CS_V5
PUSH_STR "manifestPath"
CALL_EXT host.json_text 2
STREQ
JMP CS_LOGICAL_END_133
CS_LOGICAL_132:
PUSH_INT 1
CS_LOGICAL_END_133:
JZ CS_ELSE_130
PUSH_INT 503
PUSH_STR "Duplicate saved slot or program"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_131
CS_ELSE_130:
CS_IF_END_131:
LOAD_NAME CS_V7
PUSH_INT 1
ADD
STORE_NAME CS_V7
LOAD_NAME CS_V7
STORE_NAME CS_TMP0
CS_CONTINUE_128:
JMP CS_LOOP_127
CS_LOOP_END_129:
LOAD_NAME CS_V4
LOAD_NAME CS_V5
CALL_EXT host.json_array_append 2
STORE_NAME CS_V4
LOAD_NAME CS_V4
STORE_NAME CS_TMP1
LOAD_NAME CS_V3
PUSH_INT 1
ADD
STORE_NAME CS_V3
LOAD_NAME CS_V3
STORE_NAME CS_TMP2
CS_CONTINUE_117:
JMP CS_LOOP_116
CS_LOOP_END_118:
PUSH_INT 0
STORE_NAME CS_V3
LOAD_NAME CS_V3
STORE_NAME CS_TMP3
CS_LOOP_134:
LOAD_NAME CS_V3
LOAD_NAME CS_V2
LT
JZ CS_LOOP_END_136
LOAD_NAME CS_V1
LOAD_NAME CS_V3
CALL_EXT host.json_array_get 2
STORE_NAME CS_V9
LOAD_NAME CS_V9
PUSH_STR "slot"
CALL_EXT host.json_integer 2
STORE_NAME CS_V10
LOAD_NAME CS_V10
CALL_EXT host.scheduler_slot 1
STORE_NAME CS_V11
LOAD_NAME CS_V11
PUSH_STR "{}"
STRNEQ
JZ CS_LOGICAL_139
LOAD_NAME CS_V11
LOAD_NAME CS_V9
STRNEQ
JMP CS_LOGICAL_END_140
CS_LOGICAL_139:
PUSH_INT 0
CS_LOGICAL_END_140:
JZ CS_ELSE_137
PUSH_INT 409
PUSH_STR "Recovery slot is occupied"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_138
CS_ELSE_137:
CS_IF_END_138:
LOAD_NAME CS_V3
PUSH_INT 1
ADD
STORE_NAME CS_V3
LOAD_NAME CS_V3
STORE_NAME CS_TMP4
CS_CONTINUE_135:
JMP CS_LOOP_134
CS_LOOP_END_136:
PUSH_INT 0
STORE_NAME CS_V3
LOAD_NAME CS_V3
STORE_NAME CS_TMP5
CS_LOOP_141:
LOAD_NAME CS_V3
LOAD_NAME CS_V2
LT
JZ CS_LOOP_END_143
LOAD_NAME CS_V1
LOAD_NAME CS_V3
CALL_EXT host.json_array_get 2
STORE_NAME CS_V12
LOAD_NAME CS_V12
PUSH_STR "slot"
CALL_EXT host.json_integer 2
STORE_NAME CS_V13
LOAD_NAME CS_V13
CALL_EXT host.scheduler_slot 1
PUSH_STR "{}"
STREQ
JZ CS_ELSE_144
LOAD_NAME CS_V13
LOAD_NAME CS_V12
CALL_EXT host.scheduler_stage 2
STORE_NAME CS_V14
LOAD_NAME CS_V14
PUSH_INT 200
NEQ
JZ CS_ELSE_146
LOAD_NAME CS_V14
CALL_EXT host.scheduler_error 0
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_147
CS_ELSE_146:
CS_IF_END_147:
LOAD_NAME CS_V13
CALL_EXT host.scheduler_activate 1
STORE_NAME CS_V15
LOAD_NAME CS_V15
PUSH_INT 200
NEQ
JZ CS_ELSE_148
CALL_EXT host.scheduler_error 0
STORE_NAME CS_V16
LOAD_NAME CS_V13
CALL_EXT host.scheduler_remove 1
PUSH_INT 200
NEQ
JZ CS_ELSE_150
PUSH_INT 503
PUSH_STR "Recovery cleanup failed"
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_151
CS_ELSE_150:
CS_IF_END_151:
LOAD_NAME CS_V15
LOAD_NAME CS_V16
CALL CS_METHOD_1 2
RET
JMP CS_IF_END_149
CS_ELSE_148:
CS_IF_END_149:
JMP CS_IF_END_145
CS_ELSE_144:
CS_IF_END_145:
LOAD_NAME CS_V3
PUSH_INT 1
ADD
STORE_NAME CS_V3
LOAD_NAME CS_V3
STORE_NAME CS_TMP6
CS_CONTINUE_142:
JMP CS_LOOP_141
CS_LOOP_END_143:
CALL CS_METHOD_5 0
RET
RET
MAIN:
CALL CS_METHOD_0 0
HALT
)pulse_scheduler";
static const char SLOT_SCHEDULER_MAP[] = R"pulse_scheduler(
{"globals":[],"procedures":{"CS_METHOD_0":{"label":"CS_METHOD_0","name":"Program.Main","signature":"Program.Main`0()","params":[],"locals":["CS_V0","CS_V1","CS_TMP0","CS_TMP1","CS_TMP2","CS_TMP3","CS_TMP4","CS_TMP5"],"parameterTypes":[],"returnType":"void","visibility":"public","typeArguments":[],"variables":[{"name":"operation","type":"string","nullable":false,"slot":"CS_V0","mutable":false},{"name":"request","type":"string","nullable":false,"slot":"CS_V1","mutable":false}]},"CS_METHOD_1":{"label":"CS_METHOD_1","name":"Program.respondError","signature":"Program.respondError`0(int,string)","params":["CS_V0","CS_V1"],"locals":["CS_V2","CS_TMP0"],"parameterTypes":["int","string"],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"status","type":"int","nullable":false,"slot":"CS_V0","mutable":false},{"name":"message","type":"string","nullable":false,"slot":"CS_V1","mutable":false},{"name":"error","type":"string","nullable":false,"slot":"CS_V2","mutable":true}]},"CS_METHOD_2":{"label":"CS_METHOD_2","name":"Program.validSlot","signature":"Program.validSlot`0(int)","params":["CS_V0"],"locals":["CS_TMP0","CS_TMP1"],"parameterTypes":["int"],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"slot","type":"int","nullable":false,"slot":"CS_V0","mutable":false}]},"CS_METHOD_3":{"label":"CS_METHOD_3","name":"Program.persistent","signature":"Program.persistent`0(string)","params":["CS_V0"],"locals":["CS_V1"],"parameterTypes":["string"],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"descriptor","type":"string","nullable":false,"slot":"CS_V0","mutable":false},{"name":"kind","type":"string","nullable":false,"slot":"CS_V1","mutable":false}]},"CS_METHOD_4":{"label":"CS_METHOD_4","name":"Program.snapshot","signature":"Program.snapshot`0(int)","params":["CS_V0"],"locals":["CS_V1","CS_V2","CS_V3","CS_TMP0","CS_TMP1"],"parameterTypes":["int"],"returnType":"string","visibility":"public","typeArguments":[],"variables":[{"name":"excluded","type":"int","nullable":false,"slot":"CS_V0","mutable":false},{"name":"entries","type":"string","nullable":false,"slot":"CS_V1","mutable":true},{"name":"index","type":"int","nullable":false,"slot":"CS_V2","mutable":true},{"name":"descriptor","type":"string","nullable":false,"slot":"CS_V3","mutable":false}]},"CS_METHOD_5":{"label":"CS_METHOD_5","name":"Program.status","signature":"Program.status`0()","params":[],"locals":["CS_V0","CS_V1","CS_V2","CS_TMP0","CS_TMP1","CS_TMP2","CS_TMP3"],"parameterTypes":[],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"entries","type":"string","nullable":false,"slot":"CS_V0","mutable":true},{"name":"index","type":"int","nullable":false,"slot":"CS_V1","mutable":true},{"name":"descriptor","type":"string","nullable":false,"slot":"CS_V2","mutable":true}]},"CS_METHOD_6":{"label":"CS_METHOD_6","name":"Program.load","signature":"Program.load`0(string)","params":["CS_V0"],"locals":["CS_V1","CS_V2","CS_V3","CS_V4","CS_V5","CS_V6","CS_V7","CS_V8","CS_V9","CS_V10","CS_V11","CS_V12","CS_V13","CS_V14","CS_V15","CS_V16","CS_TMP0","CS_TMP1","CS_TMP2","CS_TMP3","CS_TMP4","CS_TMP5","CS_TMP6","CS_TMP7","CS_TMP8","CS_TMP9","CS_TMP10","CS_TMP11","CS_TMP12"],"parameterTypes":["string"],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"request","type":"string","nullable":false,"slot":"CS_V0","mutable":false},{"name":"slot","type":"int","nullable":false,"slot":"CS_V1","mutable":true},{"name":"manifestPath","type":"string","nullable":false,"slot":"CS_V2","mutable":false},{"name":"manifest","type":"string","nullable":false,"slot":"CS_V3","mutable":false},{"name":"kind","type":"string","nullable":false,"slot":"CS_V4","mutable":false},{"name":"index","type":"int","nullable":false,"slot":"CS_V5","mutable":true},{"name":"freeSlot","type":"int","nullable":false,"slot":"CS_V6","mutable":true},{"name":"existing","type":"string","nullable":false,"slot":"CS_V7","mutable":false},{"name":"descriptor","type":"string","nullable":false,"slot":"CS_V8","mutable":true},{"name":"oldState","type":"string","nullable":false,"slot":"CS_V9","mutable":true},{"name":"newState","type":"string","nullable":false,"slot":"CS_V10","mutable":true},{"name":"savedSlots","type":"string","nullable":false,"slot":"CS_V11","mutable":false},{"name":"staged","type":"int","nullable":false,"slot":"CS_V12","mutable":false},{"name":"writeError","type":"string","nullable":false,"slot":"CS_V13","mutable":false},{"name":"activated","type":"int","nullable":false,"slot":"CS_V14","mutable":false},{"name":"activationError","type":"string","nullable":false,"slot":"CS_V15","mutable":false},{"name":"result","type":"string","nullable":false,"slot":"CS_V16","mutable":true}]},"CS_METHOD_7":{"label":"CS_METHOD_7","name":"Program.unload","signature":"Program.unload`0(string)","params":["CS_V0"],"locals":["CS_V1","CS_V2","CS_V3","CS_V4","CS_V5","CS_V6","CS_V7"],"parameterTypes":["string"],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"request","type":"string","nullable":false,"slot":"CS_V0","mutable":false},{"name":"slot","type":"int","nullable":false,"slot":"CS_V1","mutable":false},{"name":"descriptor","type":"string","nullable":false,"slot":"CS_V2","mutable":false},{"name":"oldState","type":"string","nullable":false,"slot":"CS_V3","mutable":false},{"name":"durable","type":"int","nullable":false,"slot":"CS_V4","mutable":false},{"name":"removed","type":"int","nullable":false,"slot":"CS_V5","mutable":false},{"name":"removeError","type":"string","nullable":false,"slot":"CS_V6","mutable":false},{"name":"result","type":"string","nullable":false,"slot":"CS_V7","mutable":true}]},"CS_METHOD_8":{"label":"CS_METHOD_8","name":"Program.restoreSlots","signature":"Program.restoreSlots`0()","params":[],"locals":["CS_V0","CS_V1","CS_V2","CS_V3","CS_V4","CS_V5","CS_V6","CS_V7","CS_V8","CS_V9","CS_V10","CS_V11","CS_V12","CS_V13","CS_V14","CS_V15","CS_V16","CS_TMP0","CS_TMP1","CS_TMP2","CS_TMP3","CS_TMP4","CS_TMP5","CS_TMP6"],"parameterTypes":[],"returnType":"int","visibility":"public","typeArguments":[],"variables":[{"name":"saved","type":"string","nullable":false,"slot":"CS_V0","mutable":false},{"name":"entries","type":"string","nullable":false,"slot":"CS_V1","mutable":false},{"name":"count","type":"int","nullable":false,"slot":"CS_V2","mutable":false},{"name":"index","type":"int","nullable":false,"slot":"CS_V3","mutable":true},{"name":"seen","type":"string","nullable":false,"slot":"CS_V4","mutable":true},{"name":"descriptor","type":"string","nullable":false,"slot":"CS_V5","mutable":false},{"name":"slot","type":"int","nullable":false,"slot":"CS_V6","mutable":false},{"name":"earlier","type":"int","nullable":false,"slot":"CS_V7","mutable":true},{"name":"previous","type":"string","nullable":false,"slot":"CS_V8","mutable":false},{"name":"recovered","type":"string","nullable":false,"slot":"CS_V9","mutable":false},{"name":"target","type":"int","nullable":false,"slot":"CS_V10","mutable":false},{"name":"current","type":"string","nullable":false,"slot":"CS_V11","mutable":false},{"name":"entry","type":"string","nullable":false,"slot":"CS_V12","mutable":false},{"name":"destination","type":"int","nullable":false,"slot":"CS_V13","mutable":false},{"name":"stageStatus","type":"int","nullable":false,"slot":"CS_V14","mutable":false},{"name":"startStatus","type":"int","nullable":false,"slot":"CS_V15","mutable":false},{"name":"startError","type":"string","nullable":false,"slot":"CS_V16","mutable":false}]}}})pulse_scheduler";
}
