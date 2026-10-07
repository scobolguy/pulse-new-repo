program "new-pascalish-program";
role code_librarian;
library "core-shared" from librarian;
interop wfl "new-workflow" as wf;

var myLegacyMessage : swift-mt103 from librarian;

// Import a data map from the Data Mapper
import mapper "my-map-id" from mapper;
