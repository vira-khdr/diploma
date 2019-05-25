module.exports = XJSMapper;

function XJSMapper(args) {
    if (!args.xjs) throw "xjs is required";
    if (!args.mappings) throw "mappings are required";

    this.xjs      = args.xjs;
    this.mappings = args.mappings;

    this._init();
}

XJSMapper.prototype = {
    get: function(path) {
        var submapping = this._getMappingByPath(path);
        return this._dereferenceMapping(submapping);
    },
    set: function(data) {
        var flatternMapping = this.flattern;

        for ( var fullPath in data ) {
            var value = data[fullPath];

            fullPath = this._normalizePath(fullPath);

            var mappingPath  = fullPath.replace(/(\/\d+){2}$/, '');
            var excelAddress = flatternMapping[mappingPath];

            if ( !excelAddress ) {
                mappingPath  = fullPath.replace(/(\/\d+){1}$/, ''); // assume mapping contain []
                excelAddress = flatternMapping[mappingPath];
            }

            if ( !excelAddress ) {
                throw "WRONG PATH " + fullPath;
            }

            var rowOffset = 0;
            var colOffset = 0;

            var matched = fullPath.match(/\/(\d+)\/?(\d+)?$/);
            if (matched) {
                rowOffset = matched[1] || 0;
                colOffset = matched[2] || 0;
            }

            var parsedAddr = this.xjs.addressParser.parse(excelAddress);

            var cellAddr = matched ? {
                sheet: parsedAddr.sheet,
                col: parseInt(parsedAddr.startCol, 10) + parseInt(colOffset,10),
                row: parseInt(parsedAddr.startRow, 10) + parseInt(rowOffset,10)
            } : parsedAddr;

            if (cellAddr.type === 'range') {
                const { endCol, endRow, sheet, startCol, startRow } = cellAddr;

                for (let row = startRow, i = 0; row < endRow + 1; row++, i++) {
                    for (let col = startCol, j = 0; col < endCol + 1; col++, j++) {
                        this.xjs._setCellValue({ type: 'cell', sheet, row, col }, value[i][j]);
                    }
                }
            } else this.xjs._setCellValue(cellAddr, value);
        }
    },
    recompute: function(on_ready) {
        this.xjs.recompute(on_ready);
    },
    _init: function() {
        this.flattern = this.flatternKeys(this.mappings);
    },
    _dereferenceMapping: function(mapping, dereferenced_parent) {
        var dereferenced = dereferenced_parent || {};

        if ( typeof(mapping) === 'object' ) {
            for ( var name in mapping ) {
                dereferenced[name] = this._dereferenceMapping(mapping[name]);
            }

            return dereferenced;
        }

        var address = mapping;
        return this.xjs.getCellValue(address);
    },
    _getMappingByPath: function(inputPath) {
        if ( inputPath == '/'  ) {
            return this.mappings;
        }

        var path   = this._normalizePath(inputPath);
        var parts  = path.split(/\//);
        var parent = this.mappings;

        for ( var i = 0; i < parts.length; i++ ) {
            var part = parts[i];
            if (parent[part]) {
                parent = parent[part];
            } else {
                throw "WRONG PATH " + path;
            }
        }

        return parent;
    },
    _normalizePath: function(path) {
        return path.replace(/\/$/, '').replace(/^\//, '');
    },
    flatternKeys: function(object, parent_key, flattern) {
        if (!flattern) flattern = {};

        for ( var key in object ) {
            var key_path =  parent_key ? (parent_key + '/' + key) : key;

            var value = object[key];

            if ( typeof(value) == 'object') {
                this.flatternKeys(value, key_path, flattern);
            } else {
                flattern[key_path] = value;
            }
        }

        return flattern;
    }
};
