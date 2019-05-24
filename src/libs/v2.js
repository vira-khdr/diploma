module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	global.__DEVELOPMENT__=1;

	var XJSModelRunnerLocal = __webpack_require__(1);
	var XJSAddressParser    = __webpack_require__(131);
	var XJSFormulaEvaluatorFactory = __webpack_require__(132);

	module.exports.create = function(model) {
	    // Create Address Parser
	    var addressParser = new XJSAddressParser({
	        sheets_names: model.sheets_names
	    });

	    // Create Model Runner
	    var formulaEvaluator = XJSFormulaEvaluatorFactory.create();
	    var model_runner = new XJSModelRunnerLocal({
	        model: model,
	        addressParser: addressParser,
	        functions: formulaEvaluator.functions,
	        formulaEvaluator: formulaEvaluator
	    });

	    return model_runner;
	};

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var XJSC = __webpack_require__(2);
	var util = __webpack_require__(3);

	var XJSModelRunnerBase = __webpack_require__(4);

	var REF    = 0;
	var RANGE  = 1;
	var OFFSET = 2;

	module.exports = XJSModelRunner;


	var __next_objid=1;
	function objectId(obj) {
	    if (obj===null) return null;
	    if (!obj.__obj_id) obj.__obj_id=__next_objid++;
	    return obj.__obj_id;
	}

	function XJSModelRunner(args) {
	    this.constructor.super_.call(this, args);

	    // Internal attrs
	    this.changed_cells = [];
	    this.valuesCache = {};
	    this.cacheVersion = 1;
	    this.model.cacheVersion = 1;
	    this.calculationQueuesCache = {};

	    this.modelSheets = this.model.sheets;
	    this.activeCell = [];

	    global.xjs = this
	}

	util.inherits(XJSModelRunner, XJSModelRunnerBase);

	XJSModelRunner.prototype._getCellValue = function(sheetNum, colNum, rowNum) {
	    var model = this.model;

	    var targetCell = this.model.sheets[sheetNum][colNum][rowNum];
	    if ( ! (targetCell instanceof Array) ) return targetCell;

	    var cellCacheVersion = targetCell[XJSC.CELL_METADATA][XJSC.MD_CACHE_VERSION];

	    if (this.cacheVersion === cellCacheVersion) {
	        return targetCell[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE];
	    }

	    var cellKey = sheetNum + '-' + colNum + '-' + rowNum;
	    var value = targetCell[XJSC.CELL_VALUE];

	    var queue = this.calculationQueuesCache[cellKey];

	    if ( !queue ) {
	        queue = this._getCalculationQueue(targetCell);
	        this.calculationQueuesCache[cellKey] = queue;
	    }

	    var queueLength = queue.length;
	    for (var i=0; i<queueLength; i++) {
	        var cellFromQueue = queue[i];

	        if (cellFromQueue[XJSC.CELL_METADATA][XJSC.MD_CACHE_VERSION] === this.cacheVersion) {
	            continue;
	        }

	        var val = cellFromQueue[XJSC.CELL_VALUE];

	        this.activeCell = cellFromQueue;
	        var calcedVal = this.formulaEvaluator.evaluate(val, model);

	        if ( (true) && this.isCheckMode) {
	            this.checkValue(calcedVal, cellFromQueue);
	        }


	        cellFromQueue[XJSC.CELL_METADATA][XJSC.MD_CACHE_VERSION] = this.cacheVersion;
	        cellFromQueue[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE] = calcedVal;
	    }

	    this.activeCell = targetCell;
	    var calcedVal = this.formulaEvaluator.evaluate(value, model);

	    if (  (true) && this.isCheckMode ) {
	        this.checkValue(calcedVal, targetCell);
	    }

	    targetCell[XJSC.CELL_METADATA][XJSC.MD_CACHE_VERSION] = this.cacheVersion;
	    targetCell[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE] = calcedVal;

	    if ( calcedVal instanceof Array ) {
	        if (calcedVal[0] !== REF) throw 'FATAL';
	        calcedVal = model.sheets[calcedVal[1]][calcedVal[2]][calcedVal[3]][XJSC.CELL_VALUE];
	    }

	    return calcedVal;

	};


	XJSModelRunner.prototype._getCalculationQueue = function(targetCell) {
	    var exporationStack = [];
	    var explorationStackCursor = -1;

	    exporationStack[++explorationStackCursor] = targetCell;

	    var queue = [];
	    var inQueue = {};

	    while ( explorationStackCursor >= 0 ) {
	        var cell = exporationStack[explorationStackCursor];
	        var dependentCells = this._getDependentCells(cell[XJSC.CELL_VALUE]);

	        var stepIn = false;
	        for ( var i=0; i < dependentCells.length; i++ ) {
	            var dcell = dependentCells[i];

	            if ( ! inQueue[ objectId(dcell) ] ) {
	                exporationStack[++explorationStackCursor] = dcell;
	                stepIn = true;
	            }
	        }

	        if ( !stepIn ) {
	            explorationStackCursor--;
	            var objId = objectId(cell);
	            if (! inQueue[ objId ]) {
	                queue.push(cell);
	                inQueue[ objId ] = true;
	            }
	        }
	    }

	    return queue;
	};


	XJSModelRunner.prototype.recompute = function(cb, isCheckMode) {
	    this.cacheVersion++;
	    this.model.cacheVersion = this.cacheVersion;
	    this.isCheckMode = isCheckMode;

	    cb(this);
	};

	XJSModelRunner.prototype._getDependentCells = function(value, deps) {
	    if (!deps) deps = [];

	    if ( ! (value instanceof Array) )  {
	        return deps;
	    }

	    if (value[0] === REF) {
	        var resolvedCell = this._resolveLink( value );
	        if ( resolvedCell instanceof Array && resolvedCell[XJSC.CELL_VALUE] instanceof Array ) {
	            deps.push( resolvedCell );
	        }
	    } else if ( value[0] === RANGE ) {
	        var skipRangeProcessing = false;
	        if ( value[2] instanceof Array && value[2][0] === OFFSET ) {
	            skipRangeProcessing = true;
	            var subval = value[2];

	            for ( var i = 2; i < subval.length; i++ ) {
	                this._getDependentCells(subval[i], deps);
	            }
	        }

	        if ( value[3] instanceof Array && value[3][0] === OFFSET ) {
	            skipRangeProcessing = true;
	            var subval = value[3];

	            for (var i = 2; i < subval.length; i++ ) {
	                this._getDependentCells(subval[i], deps);
	            }
	        }

	        if (!skipRangeProcessing) {
	            var addresses = this._getAddressesForRange(value);

	            for ( var i=0; i < addresses.length; i++ ) {
	                this._getDependentCells(addresses[i], deps);
	            }
	        }
	    } else {
	        var i = 1; // start from "1" to skip function name

	        if ( value[0] === OFFSET ) {
	            i = 2; // skip first OFFSET argument ( is reference which does not require dereferencing )
	        }

	        for ( ; i < value.length; i++ ) {
	            this._getDependentCells(value[i], deps);
	        }
	    }

	    return deps;
	};


	XJSModelRunner.prototype._getAddressesForRange = function(range) {
	    var sheetNum  = range[1];
	    var startCol  = range[2];
	    var startRow  = range[3];
	    var endCol    = range[4];
	    var endRow    = range[5];

	    var addresses = [];
	    for (var colNum = startCol; colNum <= endCol; colNum++) {
	        for (var rowNum = startRow; rowNum <= endRow; rowNum++) {
	            var address = [REF, sheetNum, colNum, rowNum];
	            addresses.push(address);
	        }
	    }

	    return addresses;
	};

	XJSModelRunner.prototype._resolveLink = function(link) {
	    if ( !this.modelSheets[ link[1] ][ link[2] ] ) {
	        return '';
	    }

	    var res = this.modelSheets[ link[1] ] [ link[2] ][ link[3] ];

	    return typeof res === void(0) ? '' : res;
	};

	XJSModelRunner.prototype._resolveLinks = function(links) {
	    var sheets = this.modelSheets;

	    var cells = [];

	    var linksLength = links.length;

	    for ( var i=0; i < linksLength; i += 1 ) {
	        var sheetNum = links[i][1];
	        var colNum   = links[i][2];
	        var rowNum   = links[i][3];

	        cells[i] = sheets[sheetNum][colNum][rowNum];
	    }

	    return cells;
	};


	XJSModelRunner.prototype.dumpCalculationQueuesCache = function() {
	    var cacheDump = {};
	    for (var cellKey in this.calculationQueuesCache) {
	        if (!cacheDump[cellKey]) {
	            cacheDump[cellKey] = [];
	        }

	        var queue = this.calculationQueuesCache[cellKey];

	        for (var i = 0; i < queue.length; i++) {
	            var cell = queue[i];
	            var address  = cell[XJSC.CELL_METADATA][XJSC.MD_CELL_ADDRESS];

	            cacheDump[cellKey].push(address[0]);
	            cacheDump[cellKey].push(address[1]);
	            cacheDump[cellKey].push(address[2]);
	        }
	    }

	    return cacheDump;
	};

	XJSModelRunner.prototype.loadCalculationQueuesCache = function(cacheDump) {
	    this.calculationQueuesCache = {};

	    for (var cellKey in cacheDump) {
	        if (!this.calculationQueuesCache[cellKey]) {
	            this.calculationQueuesCache[cellKey] = [];
	        }

	        var addresses = cacheDump[cellKey];

	        for (var i = 0; i < addresses.length; i += 3) {
	            var sheetNum = addresses[i];
	            var colNum   = addresses[i+1];
	            var rowNum   = addresses[i+2];

	            var cell = this._resolveLink([0, sheetNum, colNum, rowNum ]);
	            this.calculationQueuesCache[cellKey].push( cell );
	        }
	    }
	};



/***/ }),
/* 2 */
/***/ (function(module, exports) {

	"use strict";

	var constants = {
	    CELL_VALUE: 0,
	    CELL_METADATA: 1,
	    MD_CACHED_VALUE: 0,
	    MD_CACHE_VERSION: 1,
	    MD_CELL_ADDRESS: 2
	};

	module.exports = constants;

/***/ }),
/* 3 */
/***/ (function(module, exports) {

	module.exports = require("util");

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var XJSC = __webpack_require__(2);

	if ( true) {
	    var BackAddressConvertor = __webpack_require__(5);
	    var BackFormulaConvertor = __webpack_require__(6);
	    var clc = __webpack_require__(7);
	    var sprintf = __webpack_require__(130).sprintf;
	}

	module.exports = XJSModelRunnerBase;

	function XJSModelRunnerBase(args) {

	    if (!args) throw "Parameters required";
	    if (!args.model) throw "Model required";
	    if (!args.addressParser) throw "Address Parser required";
	    if (!args.formulaEvaluator) throw "Formula evaluator required";

	    // Injected attrs
	    this.model = args.model;
	    this.addressParser = args.addressParser;
	    this.formulaEvaluator = args.formulaEvaluator;

	    if ( true) {
	        this.backAddressConvertor = new BackAddressConvertor({sheetsNames: this.model.sheets_names});
	        this.backFormulaConvertor = new BackFormulaConvertor({backAddressConvertor: this.backAddressConvertor});
	    }

	    this.formulaEvaluator.runner = this;
	}

	XJSModelRunnerBase.prototype = {
	    setCellValue: function(excelAddr, val) {
	        var addr = this.addressParser.parse(excelAddr);
	        this._setCellValue(addr, val);
	    },

	    getCellValue: function(excelAddr) {
	        try {
	            var addr = this.addressParser.parse(excelAddr);

	            if ( addr.type === 'cell' ) {
	                return this._getCellValue(addr.sheet, addr.col, addr.row);
	            } else if ( addr.type === 'range' ) {
	                var resultRange = [];
	                var targetRange = [];

	                var is_single_range = false;
	                if (addr.startRow == addr.endRow || addr.startCol == addr.endCol) {
	                    is_single_range = true;
	                    targetRange = resultRange;
	                }

	                for (var rowNum = addr.startRow;  rowNum <= addr.endRow; rowNum++) {
	                    if (!is_single_range) {
	                        targetRange = [];
	                        resultRange.push(targetRange);
	                    }

	                    for (var colNum = addr.startCol;  colNum <= addr.endCol; colNum++) {
	                        var value = this._getCellValue(addr.sheet, colNum, rowNum);
	                        targetRange.push(value);
	                    }
	                }

	                return resultRange;
	            }
	        } catch (e) {
	            if ( this.activeCell && this.activeCell.length ) {
	                this._revaluateCellWithDebug(this.activeCell);
	            }

	            throw e;
	        }
	    },

	    _setCellValue: function(addr, val) {
	        var cellData  = this.model.sheets[addr.sheet][addr.col][addr.row];

	        if ( !Array.isArray(cellData) ) {
	            this.model.sheets[addr.sheet][addr.col][addr.row] = val;
	        } else {
	            cellData[XJSC.CELL_VALUE] = val;
	            cellData[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE] = val;
	            this.changed_cells.push(cellData);
	        }
	    },

	    getSheetsNames: function() {
	        return Object.keys( this.model.sheets_names );
	    },

	    isFormulaCell: function(excelAddr) {
	        var addr = this.addressParser.parse(excelAddr);

	        if ( addr.type == 'cell' ) {
	            var cellData  = this.model.sheets[addr.sheet][addr.col][addr.row];
	            var cellValue = cellData[XJSC.CELL_VALUE];
	            return Array.isArray(cellValue) ? true : false;
	        } else if ( addr.type == 'range' ) {
	            throw 'RANGES ARE NOT SUPPORTED';
	        }
	    },

	    checkValue: function(calcedVal, cell) {
	        if ( true) {
	            var internalCellAddr = cell[XJSC.CELL_METADATA][XJSC.MD_CELL_ADDRESS];

	            var excelAddr = this.backAddressConvertor.convert({
	                sheetNum: internalCellAddr[0],
	                colNum:   internalCellAddr[1],
	                rowNum:   internalCellAddr[2]
	            });

	            var cachedVal = cell[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE];

	            console.log(sprintf('| %40.40s | %25.25s | %25.25s |', excelAddr, calcedVal, cachedVal));

	            var newVal =  calcedVal + '';
	            if (Array.isArray(calcedVal) && calcedVal[0] == '=') {
	                var calcedCellAddress = this.backAddressConvertor.convert({
	                    sheetNum: calcedVal[1],
	                    colNum:   calcedVal[2],
	                    rowNum:   calcedVal[3]
	                });

	                console.log('GOT CELL REFERENCE [%s]. GOING DEEPER', calcedCellAddress);
	                newVal = this.formulaEvaluator.evaluate(calcedVal, this.model);
	            }

	            var oldVal = cell[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE] + '';

	            if ( !isNaN(+oldVal) ) {
	                var delta = Math.abs(newVal - oldVal);
	                var hasError = isNaN(delta) || isNaN(newVal) || delta >= 0.000001;

	                if ( hasError ) {
	                    console.log(clc.redBright('\nGOT=[%s] EXPECTED=[%s]\n'), newVal, oldVal);
	                    this._revaluateCellWithDebug(cell);
	                }
	            }
	        }
	    },

	    _revaluateCellWithDebug: function(cell) {
	        if ( true) {
	            var internalCellAddr = cell[XJSC.CELL_METADATA][XJSC.MD_CELL_ADDRESS];

	            var excelAddr = this.backAddressConvertor.convert({
	                sheetNum: internalCellAddr[0],
	                colNum:   internalCellAddr[1],
	                rowNum:   internalCellAddr[2]
	            });

	            console.log(clc.redBright('ERROR IN CELL: %s'), clc.yellow(excelAddr));
	            console.log(clc.redBright('FULL FORMULA:', this.backFormulaConvertor.convert(cell[XJSC.CELL_VALUE])));

	            console.log(clc.yellowBright('\nSTARTING FORMULA REVALUATION IN DEBUG MODE:\n'));

	            this.formulaEvaluator.evaluate(cell[XJSC.CELL_VALUE], this.model, true);
	            this.activeCell = [];
	            throw "CALC ERROR";
	        }
	    }


	};


/***/ }),
/* 5 */
/***/ (function(module, exports) {

	'use strict';

	function BackAddressConvertor(args) {
	    if (!args.sheetsNames) throw "args.sheetsNames required";

	    var letters2numbers = {"JM":272,"BC":54,"AT":45,"SZ":519,"YT":669,"WM":610,"JN":273,"BN":65,"JU":280,"OG":396,"KK":296,"UI":554,"FH":163,"VW":594,"SH":501,"WD":601,"MP":353,"XS":642,"UZ":571,"RQ":484,"PW":438,"EN":143,"TK":530,"JV":281,"FC":158,"YF":655,"EE":134,"QU":462,"NX":387,"CK":88,"EK":140,"AA":26,"M":12,"VO":586,"EP":145,"LG":318,"AH":33,"LO":326,"SR":511,"MG":344,"ON":403,"KU":306,"FT":175,"BT":71,"YY":674,"YL":661,"RY":492,"CC":80,"RR":485,"NC":366,"HQ":224,"Z":25,"TB":521,"LL":323,"FQ":172,"AZ":51,"OV":411,"AF":31,"KE":290,"XK":634,"OM":402,"WY":622,"HD":211,"U":20,"ID":237,"F":5,"EB":131,"QT":461,"GM":194,"PO":430,"GK":192,"UP":561,"HL":219,"QJ":451,"FI":164,"VE":576,"MX":361,"QB":443,"IL":245,"R":17,"RC":470,"DO":118,"NK":374,"TS":538,"YU":670,"TG":526,"KC":288,"FA":156,"BB":53,"HV":229,"OB":391,"PA":416,"QA":442,"CV":99,"GD":185,"EX":153,"RB":469,"JC":262,"MF":343,"OF":395,"BL":63,"DU":124,"AU":46,"UE":550,"RJ":477,"IR":251,"XD":627,"EO":144,"XH":631,"MK":348,"LZ":337,"EQ":146,"AG":32,"HG":214,"GZ":207,"KT":305,"AI":34,"YM":662,"AN":39,"WL":609,"VV":593,"ZV":697,"HY":232,"EH":137,"KN":299,"IG":240,"SC":496,"JL":271,"T":19,"NL":375,"MS":356,"EC":132,"MY":362,"UJ":555,"IO":248,"XJ":633,"EV":151,"ZP":691,"RS":486,"JI":268,"CN":91,"MB":339,"KD":289,"US":564,"G":6,"BU":72,"FJ":165,"OC":392,"FS":174,"ND":367,"TP":535,"TZ":545,"GT":201,"DT":123,"QI":450,"DF":109,"BM":64,"BV":73,"OW":412,"OA":390,"HF":213,"HC":210,"WG":604,"IU":254,"SY":518,"SK":504,"PI":424,"DW":126,"S":18,"VZ":597,"GL":193,"IJ":243,"KI":294,"CD":81,"AO":40,"BW":74,"ZW":698,"WZ":623,"VC":574,"JP":275,"NM":376,"TJ":529,"J":9,"LC":314,"MN":351,"EY":154,"GX":205,"TX":543,"WS":616,"D":3,"GO":196,"UN":559,"NV":385,"UD":549,"BP":67,"HB":209,"UM":558,"BE":56,"EL":141,"XE":628,"YR":667,"KL":297,"OX":413,"LQ":328,"C":2,"CT":97,"FV":177,"OL":401,"FE":160,"CM":90,"X":23,"HS":226,"TM":532,"GA":182,"IY":258,"UK":556,"LA":312,"SQ":510,"PH":423,"XM":636,"TF":525,"TE":524,"KZ":311,"TQ":536,"EW":152,"SJ":503,"NE":368,"DM":116,"WT":617,"RA":468,"AD":29,"WN":611,"GS":200,"YX":673,"ME":342,"AX":49,"VN":585,"YE":654,"IP":249,"OR":407,"UC":548,"OE":394,"WJ":607,"LB":313,"DV":125,"FK":166,"DE":108,"MV":359,"MI":346,"GI":190,"CS":96,"RT":487,"LX":335,"YK":660,"SB":495,"PS":434,"SX":517,"WE":602,"GB":183,"K":10,"Y":24,"E":4,"QO":456,"VP":587,"ZZ":701,"QH":449,"KM":298,"CE":82,"PC":418,"OY":414,"OD":393,"MQ":354,"SW":516,"VY":596,"JH":267,"KJ":295,"LF":317,"WA":598,"BO":66,"VX":595,"UR":563,"EM":142,"AL":37,"XL":635,"HW":230,"VD":575,"MD":341,"FU":176,"UO":560,"L":11,"GN":195,"QQ":458,"NW":386,"AP":41,"QY":466,"AQ":42,"IZ":259,"JO":274,"CU":98,"CL":89,"BX":75,"ET":149,"IS":252,"DL":115,"OK":400,"FB":157,"UU":566,"HI":216,"TI":528,"OS":408,"IF":239,"YD":653,"QG":448,"MH":345,"BG":58,"HA":208,"TL":531,"DY":128,"ZE":680,"SP":509,"YS":668,"ZT":695,"IM":246,"RI":476,"ZF":681,"DR":121,"LN":325,"FL":167,"MW":360,"NN":377,"GY":206,"IA":234,"PZ":441,"PK":426,"YJ":659,"WK":608,"NF":369,"ZU":696,"TD":523,"SO":508,"HP":223,"BD":55,"GV":203,"DJ":113,"CQ":94,"ZN":689,"ZM":688,"XG":630,"XV":645,"AY":50,"PR":433,"WV":619,"OQ":406,"DI":112,"JG":266,"DP":119,"MA":338,"SV":515,"MT":357,"JR":277,"YZ":675,"FX":179,"LR":329,"TN":533,"UB":547,"BY":76,"PJ":425,"Q":16,"IC":236,"KR":303,"NO":378,"YH":657,"BF":57,"GC":184,"AM":38,"XW":646,"NT":383,"RH":475,"ZL":687,"PB":417,"DD":107,"CF":83,"QX":465,"AE":30,"BA":52,"LE":316,"TH":527,"SU":514,"VH":579,"EA":130,"ZG":682,"XB":625,"UL":557,"KF":291,"VL":583,"WP":613,"XO":638,"WQ":614,"EF":135,"QF":447,"EU":150,"TO":534,"XN":637,"SE":498,"IV":255,"NQ":380,"NG":370,"QP":457,"YC":652,"BJ":61,"B":1,"H":7,"ZS":694,"ZD":679,"LK":322,"RV":489,"WH":605,"FM":168,"DX":127,"LV":333,"OJ":399,"RU":488,"IH":241,"KQ":302,"XT":643,"LH":319,"YP":665,"LU":332,"DS":122,"VI":580,"TV":541,"QN":455,"SN":507,"HH":215,"GG":188,"HU":228,"WR":615,"BQ":68,"KH":293,"JE":264,"QV":463,"DK":114,"TA":520,"DC":106,"MO":352,"NH":371,"YB":651,"FW":178,"DQ":120,"JF":265,"HR":225,"LP":327,"VQ":588,"CZ":103,"AB":27,"ZO":690,"ST":513,"IX":257,"PU":436,"UT":565,"KS":304,"TY":544,"XX":647,"PX":439,"VR":589,"VB":573,"CG":84,"EI":138,"ZK":686,"BI":60,"GW":204,"WC":600,"GR":199,"P":15,"FG":162,"PP":431,"JY":284,"UA":546,"RG":474,"XC":626,"VM":584,"HK":218,"JD":263,"CR":95,"WO":612,"VA":572,"KX":309,"QS":460,"LD":315,"SD":497,"UY":570,"YQ":666,"PY":440,"JQ":276,"MU":358,"CH":85,"LI":320,"GH":189,"KG":292,"QE":446,"YV":671,"VS":590,"NU":384,"OP":405,"ZH":683,"I":8,"PE":420,"SL":505,"QM":454,"ER":147,"IQ":250,"AS":44,"WU":618,"AV":47,"RM":480,"LY":336,"RN":481,"BK":62,"JA":260,"LT":331,"ZC":678,"FN":169,"PM":428,"SG":500,"FD":159,"TT":539,"IK":244,"AC":28,"UW":568,"XU":644,"PG":422,"NY":388,"KB":287,"YA":650,"NA":364,"XI":632,"KV":307,"VU":592,"XY":648,"GJ":191,"IT":253,"RE":472,"PV":437,"RF":473,"QW":464,"FR":173,"EG":136,"CW":100,"OT":409,"RW":490,"VF":577,"LW":334,"AJ":35,"LS":330,"SA":494,"ZA":676,"DG":110,"VJ":581,"PT":435,"NB":365,"CA":78,"PQ":432,"QZ":467,"KO":300,"ZR":693,"XZ":649,"NP":379,"WX":621,"PL":427,"XF":629,"LM":324,"MJ":347,"WB":599,"KY":310,"ZB":677,"NI":372,"GU":202,"N":13,"QL":453,"CB":79,"JK":270,"MM":350,"NR":381,"MR":355,"ZX":699,"XQ":640,"DB":105,"HX":231,"FZ":181,"OO":404,"ZJ":685,"VG":578,"DZ":129,"CI":86,"RL":479,"QR":459,"GE":186,"QD":445,"CX":101,"YW":672,"V":21,"JS":278,"JZ":285,"XR":641,"OI":398,"PN":429,"UX":569,"BH":59,"WF":603,"RO":482,"IN":247,"GP":197,"AR":43,"FO":170,"AW":48,"HN":221,"BR":69,"MC":340,"YN":663,"DA":104,"NZ":389,"UG":552,"YG":656,"EJ":139,"HJ":217,"HT":227,"ED":133,"RP":483,"TU":540,"OZ":415,"SS":512,"LJ":321,"ZI":684,"GF":187,"KW":308,"TC":522,"CP":93,"NJ":373,"SF":499,"ES":148,"MZ":363,"UH":553,"YI":658,"HO":222,"WW":620,"HE":212,"NS":382,"RX":491,"CJ":87,"FY":180,"JX":283,"XA":624,"TR":537,"DH":111,"UV":567,"CO":92,"SI":502,"VT":591,"VK":582,"SM":506,"AK":36,"IB":235,"ML":349,"JW":282,"ZY":700,"PD":419,"JJ":269,"OH":397,"WI":606,"RK":478,"W":22,"BS":70,"FP":171,"BZ":77,"ZQ":692,"CY":102,"IE":238,"TW":542,"KP":301,"XP":639,"PF":421,"QC":444,"OU":410,"RZ":493,"YO":664,"UF":551,"JB":261,"DN":117,"A":0,"IW":256,"O":14,"GQ":198,"FF":161,"UQ":562,"II":242,"KA":286,"HZ":233,"QK":452,"RD":471,"EZ":155,"JT":279,"HM":220};
	    var numbers2letters = [];
	    for (var letter in letters2numbers) {
	        var letterNumber = letters2numbers[letter];
	        numbers2letters[letterNumber] = letter;
	    }

	    var numbers2sheets = [];
	    for (var name in args.sheetsNames) {
	        var sheetNumber = args.sheetsNames[name];
	        numbers2sheets[sheetNumber] = name;
	    }

	    this.numbers2sheets = numbers2sheets;
	    this.numbers2letters = numbers2letters;

	}

	BackAddressConvertor.prototype = {
	    convert: function(addr) {
	        if (!addr) return '';

	        if (addr.sheetNum === void 0) {
	            console.error(addr);
	            throw 'sheetNum required in address';
	        }

	        if (addr.colNum === void 0) {
	            console.error(addr);
	            throw 'colNum required in address';
	        }

	        if (addr.rowNum === void 0) {
	            console.error(addr);
	            throw 'rowNum required in address';
	        }

	        return this.numbers2sheets[addr.sheetNum] + '!' + this.numbers2letters[addr.colNum] + (addr.rowNum+1);
	    }
	};



	module.exports = BackAddressConvertor;

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var clc = __webpack_require__(7);
	var functionsConstants = __webpack_require__(128);
	var XJSRangeBase = __webpack_require__(129);

	function BackFormulaConvertor(args) {
	    if (!args.backAddressConvertor) throw "[backAddressConvertor] required";

	    this.backAddressConvertor = args.backAddressConvertor;
	    this.reversedConstants = {};
	    this.colors = true; // TODO

	    for (var name in functionsConstants) {
	        this.reversedConstants[functionsConstants[name]] = name;
	    }
	}

	BackFormulaConvertor.prototype = {
	    convert: function(ast) {
	        if (ast instanceof XJSRangeBase) return ast.dump();
	        if (!Array.isArray(ast)) return clc.cyanBright(ast);

	        var operatorCode = ast[0];
	        var operatorName = this.reversedConstants[ operatorCode ];

	        if (operatorName === '=') {
	            var excelAddr =  this.backAddressConvertor.convert({
	                sheetNum: ast[1],
	                colNum: ast[2],
	                rowNum: ast[3]
	            });

	            return clc.yellow(excelAddr);
	        }

	         if (operatorName === 'RANGE' && ast.filter(function(val) { return typeof val === 'object'; }).length === 0 ) {

	            var startExcelAddr =  this.backAddressConvertor.convert({
	                sheetNum: ast[1],
	                colNum: ast[2],
	                rowNum: ast[3]
	            });

	            var endExcelAddrr =  this.backAddressConvertor.convert({
	                sheetNum: ast[1],
	                colNum: ast[4],
	                rowNum: ast[5]
	            });

	            return clc.yellow(startExcelAddr + ':' + endExcelAddrr );
	        }

	        var convertedAgruments = [];
	        for (var i = 1; i < ast.length; i++) {
	            convertedAgruments.push(this.convert(ast[i]));
	        }

	        if ( convertedAgruments.length === 2 && ['>', '<', '+', '-', '/', '*', '>=', '<=', '^', '<>'].indexOf( operatorName ) >= 0 ) {
	            return '( ' + convertedAgruments.join(' ' + clc.greenBright(operatorName)  + ' ') + ' )';
	        } else {
	            return clc.greenBright(operatorName) + '( ' + convertedAgruments.join(', ') + ' )';
	        }
	    }
	};



	module.exports = BackFormulaConvertor;

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var d = __webpack_require__(8);

	module.exports = Object.defineProperties(__webpack_require__(23), {
		windowSize: d(__webpack_require__(95)),
		erase: d(__webpack_require__(96)),
		move: d(__webpack_require__(97)),
		beep: d(__webpack_require__(101)),
		columns: d(__webpack_require__(102)),
		strip: d(__webpack_require__(110)),
		getStrippedLength: d(__webpack_require__(109)),
		slice: d(__webpack_require__(112)),
		throbber: d(__webpack_require__(113)),
		reset: d(__webpack_require__(115)),
		art: d(__webpack_require__(116))
	});


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var assign        = __webpack_require__(9)
	  , normalizeOpts = __webpack_require__(18)
	  , isCallable    = __webpack_require__(19)
	  , contains      = __webpack_require__(20)

	  , d;

	d = module.exports = function (dscr, value/*, options*/) {
		var c, e, w, options, desc;
		if ((arguments.length < 2) || (typeof dscr !== 'string')) {
			options = value;
			value = dscr;
			dscr = null;
		} else {
			options = arguments[2];
		}
		if (dscr == null) {
			c = w = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
			w = contains.call(dscr, 'w');
		}

		desc = { value: value, configurable: c, enumerable: e, writable: w };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};

	d.gs = function (dscr, get, set/*, options*/) {
		var c, e, options, desc;
		if (typeof dscr !== 'string') {
			options = set;
			set = get;
			get = dscr;
			dscr = null;
		} else {
			options = arguments[3];
		}
		if (get == null) {
			get = undefined;
		} else if (!isCallable(get)) {
			options = get;
			get = set = undefined;
		} else if (set == null) {
			set = undefined;
		} else if (!isCallable(set)) {
			options = set;
			set = undefined;
		}
		if (dscr == null) {
			c = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
		}

		desc = { get: get, set: set, configurable: c, enumerable: e };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(10)()
		? Object.assign
		: __webpack_require__(11);


/***/ }),
/* 10 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function () {
		var assign = Object.assign, obj;
		if (typeof assign !== "function") return false;
		obj = { foo: "raz" };
		assign(obj, { bar: "dwa" }, { trzy: "trzy" });
		return (obj.foo + obj.bar + obj.trzy) === "razdwatrzy";
	};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var keys  = __webpack_require__(12)
	  , value = __webpack_require__(17)
	  , max   = Math.max;

	module.exports = function (dest, src /*, …srcn*/) {
		var error, i, length = max(arguments.length, 2), assign;
		dest = Object(value(dest));
		assign = function (key) {
			try {
				dest[key] = src[key];
			} catch (e) {
				if (!error) error = e;
			}
		};
		for (i = 1; i < length; ++i) {
			src = arguments[i];
			keys(src).forEach(assign);
		}
		if (error !== undefined) throw error;
		return dest;
	};


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(13)() ? Object.keys : __webpack_require__(14);


/***/ }),
/* 13 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function () {
		try {
			Object.keys("primitive");
			return true;
		} catch (e) {
			return false;
		}
	};


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isValue = __webpack_require__(15);

	var keys = Object.keys;

	module.exports = function (object) { return keys(isValue(object) ? Object(object) : object); };


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var _undefined = __webpack_require__(16)(); // Support ES3 engines

	module.exports = function (val) {
	 return (val !== _undefined) && (val !== null);
	};


/***/ }),
/* 16 */
/***/ (function(module, exports) {

	"use strict";

	// eslint-disable-next-line no-empty-function
	module.exports = function () {};


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isValue = __webpack_require__(15);

	module.exports = function (value) {
		if (!isValue(value)) throw new TypeError("Cannot use null or undefined");
		return value;
	};


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isValue = __webpack_require__(15);

	var forEach = Array.prototype.forEach, create = Object.create;

	var process = function (src, obj) {
		var key;
		for (key in src) obj[key] = src[key];
	};

	// eslint-disable-next-line no-unused-vars
	module.exports = function (opts1 /*, …options*/) {
		var result = create(null);
		forEach.call(arguments, function (options) {
			if (!isValue(options)) return;
			process(Object(options), result);
		});
		return result;
	};


/***/ }),
/* 19 */
/***/ (function(module, exports) {

	// Deprecated

	"use strict";

	module.exports = function (obj) {
	 return typeof obj === "function";
	};


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(21)()
		? String.prototype.contains
		: __webpack_require__(22);


/***/ }),
/* 21 */
/***/ (function(module, exports) {

	"use strict";

	var str = "razdwatrzy";

	module.exports = function () {
		if (typeof str.contains !== "function") return false;
		return (str.contains("dwa") === true) && (str.contains("foo") === false);
	};


/***/ }),
/* 22 */
/***/ (function(module, exports) {

	"use strict";

	var indexOf = String.prototype.indexOf;

	module.exports = function (searchString/*, position*/) {
		return indexOf.call(this, searchString, arguments[1]) > -1;
	};


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var d              = __webpack_require__(8)
	  , assign         = __webpack_require__(9)
	  , forEach        = __webpack_require__(24)
	  , map            = __webpack_require__(27)
	  , primitiveSet   = __webpack_require__(28)
	  , setPrototypeOf = __webpack_require__(29)
	  , memoize        = __webpack_require__(34)
	  , memoizeMethods = __webpack_require__(86)

	  , sgr = __webpack_require__(89)
	  , mods = sgr.mods

	  , join = Array.prototype.join, defineProperty = Object.defineProperty
	  , max = Math.max, min = Math.min
	  , variantModes = primitiveSet('_fg', '_bg')
	  , xtermMatch, getFn;

	// Some use cli-color as: console.log(clc.red('Error!'));
	// Which is inefficient as on each call it configures new clc object
	// with memoization we reuse once created object
	var memoized = memoize(function (scope, mod) {
		return defineProperty(getFn(), '_cliColorData', d(assign({}, scope._cliColorData, mod)));
	});

	var proto = Object.create(Function.prototype, assign(map(mods, function (mod) {
		return d.gs(function () { return memoized(this, mod); });
	}), memoizeMethods({
		// xterm (255) color
		xterm: d(function (code) {
			code = isNaN(code) ? 255 : min(max(code, 0), 255);
			return defineProperty(getFn(), '_cliColorData',
				d(assign({}, this._cliColorData, {
					_fg: [xtermMatch ? xtermMatch[code] : ('38;5;' + code), 39]
				})));
		}),
		bgXterm: d(function (code) {
			code = isNaN(code) ? 255 : min(max(code, 0), 255);
			return defineProperty(getFn(), '_cliColorData',
				d(assign({}, this._cliColorData, {
					_bg: [xtermMatch ? (xtermMatch[code] + 10) : ('48;5;' + code), 49]
				})));
		})
	})));

	var getEndRe = memoize(function (code) {
		return new RegExp('\x1b\\[' + code + 'm', 'g');
	}, { primitive: true });

	if (process.platform === 'win32') xtermMatch = __webpack_require__(93);

	getFn = function () {
		return setPrototypeOf(function self(/*…msg*/) {
			var start = '', end = '', msg = join.call(arguments, ' '), conf = self._cliColorData
			  , hasAnsi = sgr.hasCSI(msg);
			forEach(conf, function (mod, key) {
				end    = sgr(mod[1]) + end;
				start += sgr(mod[0]);
				if (hasAnsi) {
					msg = msg.replace(getEndRe(mod[1]), variantModes[key] ? sgr(mod[0]) : '');
				}
			}, null, true);
			return start + msg + end;
		}, proto);
	};

	module.exports = Object.defineProperties(getFn(), {
		xtermSupported: d(!xtermMatch),
		_cliColorData: d('', {})
	});


/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(25)("forEach");


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

	// Internal method, used by iteration functions.
	// Calls a function for each key-value pair found in object
	// Optionally takes compareFn to iterate object in specific order

	"use strict";

	var callable                = __webpack_require__(26)
	  , value                   = __webpack_require__(17)
	  , bind                    = Function.prototype.bind
	  , call                    = Function.prototype.call
	  , keys                    = Object.keys
	  , objPropertyIsEnumerable = Object.prototype.propertyIsEnumerable;

	module.exports = function (method, defVal) {
		return function (obj, cb /*, thisArg, compareFn*/) {
			var list, thisArg = arguments[2], compareFn = arguments[3];
			obj = Object(value(obj));
			callable(cb);

			list = keys(obj);
			if (compareFn) {
				list.sort(typeof compareFn === "function" ? bind.call(compareFn, obj) : undefined);
			}
			if (typeof method !== "function") method = list[method];
			return call.call(method, list, function (key, index) {
				if (!objPropertyIsEnumerable.call(obj, key)) return defVal;
				return call.call(cb, thisArg, obj[key], key, obj, index);
			});
		};
	};


/***/ }),
/* 26 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (fn) {
		if (typeof fn !== "function") throw new TypeError(fn + " is not a function");
		return fn;
	};


/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var callable = __webpack_require__(26)
	  , forEach  = __webpack_require__(24)
	  , call     = Function.prototype.call;

	module.exports = function (obj, cb /*, thisArg*/) {
		var result = {}, thisArg = arguments[2];
		callable(cb);
		forEach(obj, function (value, key, targetObj, index) {
			result[key] = call.call(cb, thisArg, value, key, targetObj, index);
		});
		return result;
	};


/***/ }),
/* 28 */
/***/ (function(module, exports) {

	"use strict";

	var forEach = Array.prototype.forEach, create = Object.create;

	// eslint-disable-next-line no-unused-vars
	module.exports = function (arg /*, …args*/) {
		var set = create(null);
		forEach.call(arguments, function (name) {
			set[name] = true;
		});
		return set;
	};


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(30)()
		? Object.setPrototypeOf
		: __webpack_require__(31);


/***/ }),
/* 30 */
/***/ (function(module, exports) {

	"use strict";

	var create = Object.create, getPrototypeOf = Object.getPrototypeOf, plainObject = {};

	module.exports = function (/* CustomCreate*/) {
		var setPrototypeOf = Object.setPrototypeOf, customCreate = arguments[0] || create;
		if (typeof setPrototypeOf !== "function") return false;
		return getPrototypeOf(setPrototypeOf(customCreate(null), plainObject)) === plainObject;
	};


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint no-proto: "off" */

	// Big thanks to @WebReflection for sorting this out
	// https://gist.github.com/WebReflection/5593554

	"use strict";

	var isObject        = __webpack_require__(32)
	  , value           = __webpack_require__(17)
	  , objIsPrototypeOf = Object.prototype.isPrototypeOf
	  , defineProperty  = Object.defineProperty
	  , nullDesc        = {
		configurable: true,
		enumerable: false,
		writable: true,
		value: undefined
	}
	  , validate;

	validate = function (obj, prototype) {
		value(obj);
		if (prototype === null || isObject(prototype)) return obj;
		throw new TypeError("Prototype must be null or an object");
	};

	module.exports = (function (status) {
		var fn, set;
		if (!status) return null;
		if (status.level === 2) {
			if (status.set) {
				set = status.set;
				fn = function (obj, prototype) {
					set.call(validate(obj, prototype), prototype);
					return obj;
				};
			} else {
				fn = function (obj, prototype) {
					validate(obj, prototype).__proto__ = prototype;
					return obj;
				};
			}
		} else {
			fn = function self(obj, prototype) {
				var isNullBase;
				validate(obj, prototype);
				isNullBase = objIsPrototypeOf.call(self.nullPolyfill, obj);
				if (isNullBase) delete self.nullPolyfill.__proto__;
				if (prototype === null) prototype = self.nullPolyfill;
				obj.__proto__ = prototype;
				if (isNullBase) defineProperty(self.nullPolyfill, "__proto__", nullDesc);
				return obj;
			};
		}
		return Object.defineProperty(fn, "level", {
			configurable: false,
			enumerable: false,
			writable: false,
			value: status.level
		});
	}(
		(function () {
			var tmpObj1 = Object.create(null)
			  , tmpObj2 = {}
			  , set
			  , desc = Object.getOwnPropertyDescriptor(Object.prototype, "__proto__");

			if (desc) {
				try {
					set = desc.set; // Opera crashes at this point
					set.call(tmpObj1, tmpObj2);
				} catch (ignore) {}
				if (Object.getPrototypeOf(tmpObj1) === tmpObj2) return { set: set, level: 2 };
			}

			tmpObj1.__proto__ = tmpObj2;
			if (Object.getPrototypeOf(tmpObj1) === tmpObj2) return { level: 2 };

			tmpObj1 = {};
			tmpObj1.__proto__ = tmpObj2;
			if (Object.getPrototypeOf(tmpObj1) === tmpObj2) return { level: 1 };

			return false;
		})()
	));

	__webpack_require__(33);


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isValue = __webpack_require__(15);

	var map = { function: true, object: true };

	module.exports = function (value) {
		return (isValue(value) && map[typeof value]) || false;
	};


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

	// Workaround for http://code.google.com/p/v8/issues/detail?id=2804

	"use strict";

	var create = Object.create, shim;

	if (!__webpack_require__(30)()) {
		shim = __webpack_require__(31);
	}

	module.exports = (function () {
		var nullObject, polyProps, desc;
		if (!shim) return create;
		if (shim.level !== 1) return create;

		nullObject = {};
		polyProps = {};
		desc = {
			configurable: false,
			enumerable: false,
			writable: true,
			value: undefined
		};
		Object.getOwnPropertyNames(Object.prototype).forEach(function (name) {
			if (name === "__proto__") {
				polyProps[name] = {
					configurable: true,
					enumerable: false,
					writable: true,
					value: undefined
				};
				return;
			}
			polyProps[name] = desc;
		});
		Object.defineProperties(nullObject, polyProps);

		Object.defineProperty(shim, "nullPolyfill", {
			configurable: false,
			enumerable: false,
			writable: false,
			value: nullObject
		});

		return function (prototype, props) {
			return create(prototype === null ? nullObject : prototype, props);
		};
	}());


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var normalizeOpts = __webpack_require__(18)
	  , resolveLength = __webpack_require__(35)
	  , plain         = __webpack_require__(41);

	module.exports = function (fn/*, options*/) {
		var options = normalizeOpts(arguments[1]), length;

		if (!options.normalizer) {
			length = options.length = resolveLength(options.length, fn.length, options.async);
			if (length !== 0) {
				if (options.primitive) {
					if (length === false) {
						options.normalizer = __webpack_require__(62);
					} else if (length > 1) {
						options.normalizer = __webpack_require__(63)(length);
					}
				} else if (length === false) options.normalizer = __webpack_require__(64)();
					else if (length === 1) options.normalizer = __webpack_require__(69)();
					else options.normalizer = __webpack_require__(70)(length);
			}
		}

		// Assure extensions
		if (options.async) __webpack_require__(71);
		if (options.promise) __webpack_require__(73);
		if (options.dispose) __webpack_require__(79);
		if (options.maxAge) __webpack_require__(80);
		if (options.max) __webpack_require__(83);
		if (options.refCounter) __webpack_require__(85);

		return plain(fn, options);
	};


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var toPosInt = __webpack_require__(36);

	module.exports = function (optsLength, fnLength, isAsync) {
		var length;
		if (isNaN(optsLength)) {
			length = fnLength;
			if (!(length >= 0)) return 1;
			if (isAsync && length) return length - 1;
			return length;
		}
		if (optsLength === false) return false;
		return toPosInt(optsLength);
	};


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var toInteger = __webpack_require__(37)

	  , max = Math.max;

	module.exports = function (value) {
	 return max(0, toInteger(value));
	};


/***/ }),
/* 37 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var sign = __webpack_require__(38)

	  , abs = Math.abs, floor = Math.floor;

	module.exports = function (value) {
		if (isNaN(value)) return 0;
		value = Number(value);
		if ((value === 0) || !isFinite(value)) return value;
		return sign(value) * floor(abs(value));
	};


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(39)()
		? Math.sign
		: __webpack_require__(40);


/***/ }),
/* 39 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function () {
		var sign = Math.sign;
		if (typeof sign !== "function") return false;
		return (sign(10) === 1) && (sign(-20) === -1);
	};


/***/ }),
/* 40 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (value) {
		value = Number(value);
		if (isNaN(value) || (value === 0)) return value;
		return value > 0 ? 1 : -1;
	};


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var callable      = __webpack_require__(26)
	  , forEach       = __webpack_require__(24)
	  , extensions    = __webpack_require__(42)
	  , configure     = __webpack_require__(43)
	  , resolveLength = __webpack_require__(35);

	module.exports = function self(fn /*, options */) {
		var options, length, conf;

		callable(fn);
		options = Object(arguments[1]);

		if (options.async && options.promise) {
			throw new Error("Options 'async' and 'promise' cannot be used together");
		}

		// Do not memoize already memoized function
		if (hasOwnProperty.call(fn, "__memoized__") && !options.force) return fn;

		// Resolve length;
		length = resolveLength(options.length, fn.length, options.async && extensions.async);

		// Configure cache map
		conf = configure(fn, length, options);

		// Bind eventual extensions
		forEach(extensions, function (extFn, name) {
			if (options[name]) extFn(options[name], conf, options);
		});

		if (self.__profiler__) self.__profiler__(conf);

		conf.updateEnv();
		return conf.memoized;
	};


/***/ }),
/* 42 */
/***/ (function(module, exports) {

	"use strict";


/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint no-eq-null: 0, eqeqeq: 0, no-unused-vars: 0 */

	"use strict";

	var customError      = __webpack_require__(44)
	  , defineLength     = __webpack_require__(45)
	  , d                = __webpack_require__(8)
	  , ee               = __webpack_require__(47).methods
	  , resolveResolve   = __webpack_require__(48)
	  , resolveNormalize = __webpack_require__(61);

	var apply = Function.prototype.apply
	  , call = Function.prototype.call
	  , create = Object.create
	  , defineProperties = Object.defineProperties
	  , on = ee.on
	  , emit = ee.emit;

	module.exports = function (original, length, options) {
		var cache = create(null)
		  , conf
		  , memLength
		  , get
		  , set
		  , del
		  , clear
		  , extDel
		  , extGet
		  , extHas
		  , normalizer
		  , getListeners
		  , setListeners
		  , deleteListeners
		  , memoized
		  , resolve;
		if (length !== false) memLength = length;
		else if (isNaN(original.length)) memLength = 1;
		else memLength = original.length;

		if (options.normalizer) {
			normalizer = resolveNormalize(options.normalizer);
			get = normalizer.get;
			set = normalizer.set;
			del = normalizer.delete;
			clear = normalizer.clear;
		}
		if (options.resolvers != null) resolve = resolveResolve(options.resolvers);

		if (get) {
			memoized = defineLength(function (arg) {
				var id, result, args = arguments;
				if (resolve) args = resolve(args);
				id = get(args);
				if (id !== null) {
					if (hasOwnProperty.call(cache, id)) {
						if (getListeners) conf.emit("get", id, args, this);
						return cache[id];
					}
				}
				if (args.length === 1) result = call.call(original, this, args[0]);
				else result = apply.call(original, this, args);
				if (id === null) {
					id = get(args);
					if (id !== null) throw customError("Circular invocation", "CIRCULAR_INVOCATION");
					id = set(args);
				} else if (hasOwnProperty.call(cache, id)) {
					throw customError("Circular invocation", "CIRCULAR_INVOCATION");
				}
				cache[id] = result;
				if (setListeners) conf.emit("set", id, null, result);
				return result;
			}, memLength);
		} else if (length === 0) {
			memoized = function () {
				var result;
				if (hasOwnProperty.call(cache, "data")) {
					if (getListeners) conf.emit("get", "data", arguments, this);
					return cache.data;
				}
				if (arguments.length) result = apply.call(original, this, arguments);
				else result = call.call(original, this);
				if (hasOwnProperty.call(cache, "data")) {
					throw customError("Circular invocation", "CIRCULAR_INVOCATION");
				}
				cache.data = result;
				if (setListeners) conf.emit("set", "data", null, result);
				return result;
			};
		} else {
			memoized = function (arg) {
				var result, args = arguments, id;
				if (resolve) args = resolve(arguments);
				id = String(args[0]);
				if (hasOwnProperty.call(cache, id)) {
					if (getListeners) conf.emit("get", id, args, this);
					return cache[id];
				}
				if (args.length === 1) result = call.call(original, this, args[0]);
				else result = apply.call(original, this, args);
				if (hasOwnProperty.call(cache, id)) {
					throw customError("Circular invocation", "CIRCULAR_INVOCATION");
				}
				cache[id] = result;
				if (setListeners) conf.emit("set", id, null, result);
				return result;
			};
		}
		conf = {
			original: original,
			memoized: memoized,
			profileName: options.profileName,
			get: function (args) {
				if (resolve) args = resolve(args);
				if (get) return get(args);
				return String(args[0]);
			},
			has: function (id) {
				return hasOwnProperty.call(cache, id);
			},
			delete: function (id) {
				var result;
				if (!hasOwnProperty.call(cache, id)) return;
				if (del) del(id);
				result = cache[id];
				delete cache[id];
				if (deleteListeners) conf.emit("delete", id, result);
			},
			clear: function () {
				var oldCache = cache;
				if (clear) clear();
				cache = create(null);
				conf.emit("clear", oldCache);
			},
			on: function (type, listener) {
				if (type === "get") getListeners = true;
				else if (type === "set") setListeners = true;
				else if (type === "delete") deleteListeners = true;
				return on.call(this, type, listener);
			},
			emit: emit,
			updateEnv: function () {
				original = conf.original;
			}
		};
		if (get) {
			extDel = defineLength(function (arg) {
				var id, args = arguments;
				if (resolve) args = resolve(args);
				id = get(args);
				if (id === null) return;
				conf.delete(id);
			}, memLength);
		} else if (length === 0) {
			extDel = function () {
				return conf.delete("data");
			};
		} else {
			extDel = function (arg) {
				if (resolve) arg = resolve(arguments)[0];
				return conf.delete(arg);
			};
		}
		extGet = defineLength(function () {
			var id, args = arguments;
			if (length === 0) return cache.data;
			if (resolve) args = resolve(args);
			if (get) id = get(args);
			else id = String(args[0]);
			return cache[id];
		});
		extHas = defineLength(function () {
			var id, args = arguments;
			if (length === 0) return conf.has("data");
			if (resolve) args = resolve(args);
			if (get) id = get(args);
			else id = String(args[0]);
			if (id === null) return false;
			return conf.has(id);
		});
		defineProperties(memoized, {
			__memoized__: d(true),
			delete: d(extDel),
			clear: d(conf.clear),
			_get: d(extGet),
			_has: d(extHas)
		});
		return conf;
	};


/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var assign            = __webpack_require__(9)
	  , isObject          = __webpack_require__(32)
	  , isValue           = __webpack_require__(15)
	  , captureStackTrace = Error.captureStackTrace;

	exports = module.exports = function (message /*, code, ext*/) {
		var err = new Error(message), code = arguments[1], ext = arguments[2];
		if (!isValue(ext)) {
			if (isObject(code)) {
				ext = code;
				code = null;
			}
		}
		if (isValue(ext)) assign(err, ext);
		if (isValue(code)) err.code = code;
		if (captureStackTrace) captureStackTrace(err, exports);
		return err;
	};


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var toPosInt = __webpack_require__(36);

	var test = function (arg1, arg2) {
		return arg2;
	};

	var desc, defineProperty, generate, mixin;

	try {
		Object.defineProperty(test, "length", {
			configurable: true,
			writable: false,
			enumerable: false,
			value: 1
		});
	} catch (ignore) {}

	if (test.length === 1) {
		// ES6
		desc = { configurable: true, writable: false, enumerable: false };
		defineProperty = Object.defineProperty;
		module.exports = function (fn, length) {
			length = toPosInt(length);
			if (fn.length === length) return fn;
			desc.value = length;
			return defineProperty(fn, "length", desc);
		};
	} else {
		mixin = __webpack_require__(46);
		generate = (function () {
			var cache = [];
			return function (length) {
				var args, i = 0;
				if (cache[length]) return cache[length];
				args = [];
				while (length--) args.push("a" + (++i).toString(36));
				// eslint-disable-next-line no-new-func
				return new Function(
					"fn",
					"return function (" + args.join(", ") + ") { return fn.apply(this, arguments); };"
				);
			};
		}());
		module.exports = function (src, length) {
			var target;
			length = toPosInt(length);
			if (src.length === length) return src;
			target = generate(length)(src);
			try {
				mixin(target, src);
			} catch (ignore) {}
			return target;
		};
	}


/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var value = __webpack_require__(17)

	  , defineProperty = Object.defineProperty
	  , getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
	  , getOwnPropertyNames = Object.getOwnPropertyNames
	  , getOwnPropertySymbols = Object.getOwnPropertySymbols;

	module.exports = function (target, source) {
		var error, sourceObject = Object(value(source));
		target = Object(value(target));
		getOwnPropertyNames(sourceObject).forEach(function (name) {
			try {
				defineProperty(target, name, getOwnPropertyDescriptor(source, name));
			} catch (e) {
	 error = e;
	}
		});
		if (typeof getOwnPropertySymbols === "function") {
			getOwnPropertySymbols(sourceObject).forEach(function (symbol) {
				try {
					defineProperty(target, symbol, getOwnPropertyDescriptor(source, symbol));
				} catch (e) {
	 error = e;
	}
			});
		}
		if (error !== undefined) throw error;
		return target;
	};


/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var d        = __webpack_require__(8)
	  , callable = __webpack_require__(26)

	  , apply = Function.prototype.apply, call = Function.prototype.call
	  , create = Object.create, defineProperty = Object.defineProperty
	  , defineProperties = Object.defineProperties
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , descriptor = { configurable: true, enumerable: false, writable: true }

	  , on, once, off, emit, methods, descriptors, base;

	on = function (type, listener) {
		var data;

		callable(listener);

		if (!hasOwnProperty.call(this, '__ee__')) {
			data = descriptor.value = create(null);
			defineProperty(this, '__ee__', descriptor);
			descriptor.value = null;
		} else {
			data = this.__ee__;
		}
		if (!data[type]) data[type] = listener;
		else if (typeof data[type] === 'object') data[type].push(listener);
		else data[type] = [data[type], listener];

		return this;
	};

	once = function (type, listener) {
		var once, self;

		callable(listener);
		self = this;
		on.call(this, type, once = function () {
			off.call(self, type, once);
			apply.call(listener, this, arguments);
		});

		once.__eeOnceListener__ = listener;
		return this;
	};

	off = function (type, listener) {
		var data, listeners, candidate, i;

		callable(listener);

		if (!hasOwnProperty.call(this, '__ee__')) return this;
		data = this.__ee__;
		if (!data[type]) return this;
		listeners = data[type];

		if (typeof listeners === 'object') {
			for (i = 0; (candidate = listeners[i]); ++i) {
				if ((candidate === listener) ||
						(candidate.__eeOnceListener__ === listener)) {
					if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
					else listeners.splice(i, 1);
				}
			}
		} else {
			if ((listeners === listener) ||
					(listeners.__eeOnceListener__ === listener)) {
				delete data[type];
			}
		}

		return this;
	};

	emit = function (type) {
		var i, l, listener, listeners, args;

		if (!hasOwnProperty.call(this, '__ee__')) return;
		listeners = this.__ee__[type];
		if (!listeners) return;

		if (typeof listeners === 'object') {
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

			listeners = listeners.slice();
			for (i = 0; (listener = listeners[i]); ++i) {
				apply.call(listener, this, args);
			}
		} else {
			switch (arguments.length) {
			case 1:
				call.call(listeners, this);
				break;
			case 2:
				call.call(listeners, this, arguments[1]);
				break;
			case 3:
				call.call(listeners, this, arguments[1], arguments[2]);
				break;
			default:
				l = arguments.length;
				args = new Array(l - 1);
				for (i = 1; i < l; ++i) {
					args[i - 1] = arguments[i];
				}
				apply.call(listeners, this, args);
			}
		}
	};

	methods = {
		on: on,
		once: once,
		off: off,
		emit: emit
	};

	descriptors = {
		on: d(on),
		once: d(once),
		off: d(off),
		emit: d(emit)
	};

	base = defineProperties({}, descriptors);

	module.exports = exports = function (o) {
		return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
	};
	exports.methods = methods;


/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var toArray  = __webpack_require__(49)
	  , isValue  = __webpack_require__(15)
	  , callable = __webpack_require__(26);

	var slice = Array.prototype.slice, resolveArgs;

	resolveArgs = function (args) {
		return this.map(function (resolve, i) {
			return resolve ? resolve(args[i]) : args[i];
		}).concat(slice.call(args, this.length));
	};

	module.exports = function (resolvers) {
		resolvers = toArray(resolvers);
		resolvers.forEach(function (resolve) {
			if (isValue(resolve)) callable(resolve);
		});
		return resolveArgs.bind(resolvers);
	};


/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var from = __webpack_require__(50)

	  , isArray = Array.isArray;

	module.exports = function (arrayLike) {
		return isArray(arrayLike) ? arrayLike : from(arrayLike);
	};


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(51)()
		? Array.from
		: __webpack_require__(52);


/***/ }),
/* 51 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function () {
		var from = Array.from, arr, result;
		if (typeof from !== "function") return false;
		arr = ["raz", "dwa"];
		result = from(arr);
		return Boolean(result && (result !== arr) && (result[1] === "dwa"));
	};


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var iteratorSymbol = __webpack_require__(53).iterator
	  , isArguments    = __webpack_require__(58)
	  , isFunction     = __webpack_require__(59)
	  , toPosInt       = __webpack_require__(36)
	  , callable       = __webpack_require__(26)
	  , validValue     = __webpack_require__(17)
	  , isValue        = __webpack_require__(15)
	  , isString       = __webpack_require__(60)
	  , isArray        = Array.isArray
	  , call           = Function.prototype.call
	  , desc           = { configurable: true, enumerable: true, writable: true, value: null }
	  , defineProperty = Object.defineProperty;

	// eslint-disable-next-line complexity
	module.exports = function (arrayLike /*, mapFn, thisArg*/) {
		var mapFn = arguments[1]
		  , thisArg = arguments[2]
		  , Context
		  , i
		  , j
		  , arr
		  , length
		  , code
		  , iterator
		  , result
		  , getIterator
		  , value;

		arrayLike = Object(validValue(arrayLike));

		if (isValue(mapFn)) callable(mapFn);
		if (!this || this === Array || !isFunction(this)) {
			// Result: Plain array
			if (!mapFn) {
				if (isArguments(arrayLike)) {
					// Source: Arguments
					length = arrayLike.length;
					if (length !== 1) return Array.apply(null, arrayLike);
					arr = new Array(1);
					arr[0] = arrayLike[0];
					return arr;
				}
				if (isArray(arrayLike)) {
					// Source: Array
					arr = new Array(length = arrayLike.length);
					for (i = 0; i < length; ++i) arr[i] = arrayLike[i];
					return arr;
				}
			}
			arr = [];
		} else {
			// Result: Non plain array
			Context = this;
		}

		if (!isArray(arrayLike)) {
			if ((getIterator = arrayLike[iteratorSymbol]) !== undefined) {
				// Source: Iterator
				iterator = callable(getIterator).call(arrayLike);
				if (Context) arr = new Context();
				result = iterator.next();
				i = 0;
				while (!result.done) {
					value = mapFn ? call.call(mapFn, thisArg, result.value, i) : result.value;
					if (Context) {
						desc.value = value;
						defineProperty(arr, i, desc);
					} else {
						arr[i] = value;
					}
					result = iterator.next();
					++i;
				}
				length = i;
			} else if (isString(arrayLike)) {
				// Source: String
				length = arrayLike.length;
				if (Context) arr = new Context();
				for (i = 0, j = 0; i < length; ++i) {
					value = arrayLike[i];
					if (i + 1 < length) {
						code = value.charCodeAt(0);
						// eslint-disable-next-line max-depth
						if (code >= 0xd800 && code <= 0xdbff) value += arrayLike[++i];
					}
					value = mapFn ? call.call(mapFn, thisArg, value, j) : value;
					if (Context) {
						desc.value = value;
						defineProperty(arr, j, desc);
					} else {
						arr[j] = value;
					}
					++j;
				}
				length = j;
			}
		}
		if (length === undefined) {
			// Source: array or array-like
			length = toPosInt(arrayLike.length);
			if (Context) arr = new Context(length);
			for (i = 0; i < length; ++i) {
				value = mapFn ? call.call(mapFn, thisArg, arrayLike[i], i) : arrayLike[i];
				if (Context) {
					desc.value = value;
					defineProperty(arr, i, desc);
				} else {
					arr[i] = value;
				}
			}
		}
		if (Context) {
			desc.value = null;
			arr.length = length;
		}
		return arr;
	};


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	module.exports = __webpack_require__(54)() ? Symbol : __webpack_require__(55);


/***/ }),
/* 54 */
/***/ (function(module, exports) {

	'use strict';

	var validTypes = { object: true, symbol: true };

	module.exports = function () {
		var symbol;
		if (typeof Symbol !== 'function') return false;
		symbol = Symbol('test symbol');
		try { String(symbol); } catch (e) { return false; }

		// Return 'true' also for polyfills
		if (!validTypes[typeof Symbol.iterator]) return false;
		if (!validTypes[typeof Symbol.toPrimitive]) return false;
		if (!validTypes[typeof Symbol.toStringTag]) return false;

		return true;
	};


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

	// ES2015 Symbol polyfill for environments that do not (or partially) support it

	'use strict';

	var d              = __webpack_require__(8)
	  , validateSymbol = __webpack_require__(56)

	  , create = Object.create, defineProperties = Object.defineProperties
	  , defineProperty = Object.defineProperty, objPrototype = Object.prototype
	  , NativeSymbol, SymbolPolyfill, HiddenSymbol, globalSymbols = create(null)
	  , isNativeSafe;

	if (typeof Symbol === 'function') {
		NativeSymbol = Symbol;
		try {
			String(NativeSymbol());
			isNativeSafe = true;
		} catch (ignore) {}
	}

	var generateName = (function () {
		var created = create(null);
		return function (desc) {
			var postfix = 0, name, ie11BugWorkaround;
			while (created[desc + (postfix || '')]) ++postfix;
			desc += (postfix || '');
			created[desc] = true;
			name = '@@' + desc;
			defineProperty(objPrototype, name, d.gs(null, function (value) {
				// For IE11 issue see:
				// https://connect.microsoft.com/IE/feedbackdetail/view/1928508/
				//    ie11-broken-getters-on-dom-objects
				// https://github.com/medikoo/es6-symbol/issues/12
				if (ie11BugWorkaround) return;
				ie11BugWorkaround = true;
				defineProperty(this, name, d(value));
				ie11BugWorkaround = false;
			}));
			return name;
		};
	}());

	// Internal constructor (not one exposed) for creating Symbol instances.
	// This one is used to ensure that `someSymbol instanceof Symbol` always return false
	HiddenSymbol = function Symbol(description) {
		if (this instanceof HiddenSymbol) throw new TypeError('Symbol is not a constructor');
		return SymbolPolyfill(description);
	};

	// Exposed `Symbol` constructor
	// (returns instances of HiddenSymbol)
	module.exports = SymbolPolyfill = function Symbol(description) {
		var symbol;
		if (this instanceof Symbol) throw new TypeError('Symbol is not a constructor');
		if (isNativeSafe) return NativeSymbol(description);
		symbol = create(HiddenSymbol.prototype);
		description = (description === undefined ? '' : String(description));
		return defineProperties(symbol, {
			__description__: d('', description),
			__name__: d('', generateName(description))
		});
	};
	defineProperties(SymbolPolyfill, {
		for: d(function (key) {
			if (globalSymbols[key]) return globalSymbols[key];
			return (globalSymbols[key] = SymbolPolyfill(String(key)));
		}),
		keyFor: d(function (s) {
			var key;
			validateSymbol(s);
			for (key in globalSymbols) if (globalSymbols[key] === s) return key;
		}),

		// To ensure proper interoperability with other native functions (e.g. Array.from)
		// fallback to eventual native implementation of given symbol
		hasInstance: d('', (NativeSymbol && NativeSymbol.hasInstance) || SymbolPolyfill('hasInstance')),
		isConcatSpreadable: d('', (NativeSymbol && NativeSymbol.isConcatSpreadable) ||
			SymbolPolyfill('isConcatSpreadable')),
		iterator: d('', (NativeSymbol && NativeSymbol.iterator) || SymbolPolyfill('iterator')),
		match: d('', (NativeSymbol && NativeSymbol.match) || SymbolPolyfill('match')),
		replace: d('', (NativeSymbol && NativeSymbol.replace) || SymbolPolyfill('replace')),
		search: d('', (NativeSymbol && NativeSymbol.search) || SymbolPolyfill('search')),
		species: d('', (NativeSymbol && NativeSymbol.species) || SymbolPolyfill('species')),
		split: d('', (NativeSymbol && NativeSymbol.split) || SymbolPolyfill('split')),
		toPrimitive: d('', (NativeSymbol && NativeSymbol.toPrimitive) || SymbolPolyfill('toPrimitive')),
		toStringTag: d('', (NativeSymbol && NativeSymbol.toStringTag) || SymbolPolyfill('toStringTag')),
		unscopables: d('', (NativeSymbol && NativeSymbol.unscopables) || SymbolPolyfill('unscopables'))
	});

	// Internal tweaks for real symbol producer
	defineProperties(HiddenSymbol.prototype, {
		constructor: d(SymbolPolyfill),
		toString: d('', function () { return this.__name__; })
	});

	// Proper implementation of methods exposed on Symbol.prototype
	// They won't be accessible on produced symbol instances as they derive from HiddenSymbol.prototype
	defineProperties(SymbolPolyfill.prototype, {
		toString: d(function () { return 'Symbol (' + validateSymbol(this).__description__ + ')'; }),
		valueOf: d(function () { return validateSymbol(this); })
	});
	defineProperty(SymbolPolyfill.prototype, SymbolPolyfill.toPrimitive, d('', function () {
		var symbol = validateSymbol(this);
		if (typeof symbol === 'symbol') return symbol;
		return symbol.toString();
	}));
	defineProperty(SymbolPolyfill.prototype, SymbolPolyfill.toStringTag, d('c', 'Symbol'));

	// Proper implementaton of toPrimitive and toStringTag for returned symbol instances
	defineProperty(HiddenSymbol.prototype, SymbolPolyfill.toStringTag,
		d('c', SymbolPolyfill.prototype[SymbolPolyfill.toStringTag]));

	// Note: It's important to define `toPrimitive` as last one, as some implementations
	// implement `toPrimitive` natively without implementing `toStringTag` (or other specified symbols)
	// And that may invoke error in definition flow:
	// See: https://github.com/medikoo/es6-symbol/issues/13#issuecomment-164146149
	defineProperty(HiddenSymbol.prototype, SymbolPolyfill.toPrimitive,
		d('c', SymbolPolyfill.prototype[SymbolPolyfill.toPrimitive]));


/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var isSymbol = __webpack_require__(57);

	module.exports = function (value) {
		if (!isSymbol(value)) throw new TypeError(value + " is not a symbol");
		return value;
	};


/***/ }),
/* 57 */
/***/ (function(module, exports) {

	'use strict';

	module.exports = function (x) {
		if (!x) return false;
		if (typeof x === 'symbol') return true;
		if (!x.constructor) return false;
		if (x.constructor.name !== 'Symbol') return false;
		return (x[x.constructor.toStringTag] === 'Symbol');
	};


/***/ }),
/* 58 */
/***/ (function(module, exports) {

	"use strict";

	var objToString = Object.prototype.toString
	  , id = objToString.call(
		(function () {
			return arguments;
		})()
	);

	module.exports = function (value) {
		return objToString.call(value) === id;
	};


/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var objToString = Object.prototype.toString, id = objToString.call(__webpack_require__(16));

	module.exports = function (value) {
		return typeof value === "function" && objToString.call(value) === id;
	};


/***/ }),
/* 60 */
/***/ (function(module, exports) {

	"use strict";

	var objToString = Object.prototype.toString, id = objToString.call("");

	module.exports = function (value) {
		return (
			typeof value === "string" ||
			(value &&
				typeof value === "object" &&
				(value instanceof String || objToString.call(value) === id)) ||
			false
		);
	};


/***/ }),
/* 61 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var callable = __webpack_require__(26);

	module.exports = function (userNormalizer) {
		var normalizer;
		if (typeof userNormalizer === "function") return { set: userNormalizer, get: userNormalizer };
		normalizer = { get: callable(userNormalizer.get) };
		if (userNormalizer.set !== undefined) {
			normalizer.set = callable(userNormalizer.set);
			if (userNormalizer.delete) normalizer.delete = callable(userNormalizer.delete);
			if (userNormalizer.clear) normalizer.clear = callable(userNormalizer.clear);
			return normalizer;
		}
		normalizer.set = normalizer.get;
		return normalizer;
	};


/***/ }),
/* 62 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (args) {
		var id, i, length = args.length;
		if (!length) return "\u0002";
		id = String(args[i = 0]);
		while (--length) id += "\u0001" + args[++i];
		return id;
	};


/***/ }),
/* 63 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (length) {
		if (!length) {
			return function () {
				return "";
			};
		}
		return function (args) {
			var id = String(args[0]), i = 0, currentLength = length;
			while (--currentLength) {
				id += "\u0001" + args[++i];
			}
			return id;
		};
	};


/***/ }),
/* 64 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint max-statements: 0 */

	"use strict";

	var indexOf = __webpack_require__(65);

	var create = Object.create;

	module.exports = function () {
		var lastId = 0, map = [], cache = create(null);
		return {
			get: function (args) {
				var index = 0, set = map, i, length = args.length;
				if (length === 0) return set[length] || null;
				if ((set = set[length])) {
					while (index < length - 1) {
						i = indexOf.call(set[0], args[index]);
						if (i === -1) return null;
						set = set[1][i];
						++index;
					}
					i = indexOf.call(set[0], args[index]);
					if (i === -1) return null;
					return set[1][i] || null;
				}
				return null;
			},
			set: function (args) {
				var index = 0, set = map, i, length = args.length;
				if (length === 0) {
					set[length] = ++lastId;
				} else {
					if (!set[length]) {
						set[length] = [[], []];
					}
					set = set[length];
					while (index < length - 1) {
						i = indexOf.call(set[0], args[index]);
						if (i === -1) {
							i = set[0].push(args[index]) - 1;
							set[1].push([[], []]);
						}
						set = set[1][i];
						++index;
					}
					i = indexOf.call(set[0], args[index]);
					if (i === -1) {
						i = set[0].push(args[index]) - 1;
					}
					set[1][i] = ++lastId;
				}
				cache[lastId] = args;
				return lastId;
			},
			delete: function (id) {
				var index = 0, set = map, i, args = cache[id], length = args.length, path = [];
				if (length === 0) {
					delete set[length];
				} else if ((set = set[length])) {
					while (index < length - 1) {
						i = indexOf.call(set[0], args[index]);
						if (i === -1) {
							return;
						}
						path.push(set, i);
						set = set[1][i];
						++index;
					}
					i = indexOf.call(set[0], args[index]);
					if (i === -1) {
						return;
					}
					id = set[1][i];
					set[0].splice(i, 1);
					set[1].splice(i, 1);
					while (!set[0].length && path.length) {
						i = path.pop();
						set = path.pop();
						set[0].splice(i, 1);
						set[1].splice(i, 1);
					}
				}
				delete cache[id];
			},
			clear: function () {
				map = [];
				cache = create(null);
			}
		};
	};


/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var numberIsNaN       = __webpack_require__(66)
	  , toPosInt          = __webpack_require__(36)
	  , value             = __webpack_require__(17)
	  , indexOf           = Array.prototype.indexOf
	  , objHasOwnProperty = Object.prototype.hasOwnProperty
	  , abs               = Math.abs
	  , floor             = Math.floor;

	module.exports = function (searchElement /*, fromIndex*/) {
		var i, length, fromIndex, val;
		if (!numberIsNaN(searchElement)) return indexOf.apply(this, arguments);

		length = toPosInt(value(this).length);
		fromIndex = arguments[1];
		if (isNaN(fromIndex)) fromIndex = 0;
		else if (fromIndex >= 0) fromIndex = floor(fromIndex);
		else fromIndex = toPosInt(this.length) - floor(abs(fromIndex));

		for (i = fromIndex; i < length; ++i) {
			if (objHasOwnProperty.call(this, i)) {
				val = this[i];
				if (numberIsNaN(val)) return i; // Jslint: ignore
			}
		}
		return -1;
	};


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(67)()
		? Number.isNaN
		: __webpack_require__(68);


/***/ }),
/* 67 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function () {
		var numberIsNaN = Number.isNaN;
		if (typeof numberIsNaN !== "function") return false;
		return !numberIsNaN({}) && numberIsNaN(NaN) && !numberIsNaN(34);
	};


/***/ }),
/* 68 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (value) {
		// eslint-disable-next-line no-self-compare
		return value !== value;
	};


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var indexOf = __webpack_require__(65);

	module.exports = function () {
		var lastId = 0, argsMap = [], cache = [];
		return {
			get: function (args) {
				var index = indexOf.call(argsMap, args[0]);
				return index === -1 ? null : cache[index];
			},
			set: function (args) {
				argsMap.push(args[0]);
				cache.push(++lastId);
				return lastId;
			},
			delete: function (id) {
				var index = indexOf.call(cache, id);
				if (index !== -1) {
					argsMap.splice(index, 1);
					cache.splice(index, 1);
				}
			},
			clear: function () {
				argsMap = [];
				cache = [];
			}
		};
	};


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var indexOf = __webpack_require__(65)
	  , create = Object.create;

	module.exports = function (length) {
		var lastId = 0, map = [[], []], cache = create(null);
		return {
			get: function (args) {
				var index = 0, set = map, i;
				while (index < (length - 1)) {
					i = indexOf.call(set[0], args[index]);
					if (i === -1) return null;
					set = set[1][i];
					++index;
				}
				i = indexOf.call(set[0], args[index]);
				if (i === -1) return null;
				return set[1][i] || null;
			},
			set: function (args) {
				var index = 0, set = map, i;
				while (index < (length - 1)) {
					i = indexOf.call(set[0], args[index]);
					if (i === -1) {
						i = set[0].push(args[index]) - 1;
						set[1].push([[], []]);
					}
					set = set[1][i];
					++index;
				}
				i = indexOf.call(set[0], args[index]);
				if (i === -1) {
					i = set[0].push(args[index]) - 1;
				}
				set[1][i] = ++lastId;
				cache[lastId] = args;
				return lastId;
			},
			delete: function (id) {
				var index = 0, set = map, i, path = [], args = cache[id];
				while (index < (length - 1)) {
					i = indexOf.call(set[0], args[index]);
					if (i === -1) {
						return;
					}
					path.push(set, i);
					set = set[1][i];
					++index;
				}
				i = indexOf.call(set[0], args[index]);
				if (i === -1) {
					return;
				}
				id = set[1][i];
				set[0].splice(i, 1);
				set[1].splice(i, 1);
				while (!set[0].length && path.length) {
					i = path.pop();
					set = path.pop();
					set[0].splice(i, 1);
					set[1].splice(i, 1);
				}
				delete cache[id];
			},
			clear: function () {
				map = [[], []];
				cache = create(null);
			}
		};
	};


/***/ }),
/* 71 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint consistent-this: 0, no-shadow:0, no-eq-null: 0, eqeqeq: 0, no-unused-vars: 0 */

	// Support for asynchronous functions

	"use strict";

	var aFrom        = __webpack_require__(50)
	  , objectMap    = __webpack_require__(27)
	  , mixin        = __webpack_require__(46)
	  , defineLength = __webpack_require__(45)
	  , nextTick     = __webpack_require__(72);

	var slice = Array.prototype.slice, apply = Function.prototype.apply, create = Object.create;

	__webpack_require__(42).async = function (tbi, conf) {
		var waiting = create(null)
		  , cache = create(null)
		  , base = conf.memoized
		  , original = conf.original
		  , currentCallback
		  , currentContext
		  , currentArgs;

		// Initial
		conf.memoized = defineLength(function (arg) {
			var args = arguments, last = args[args.length - 1];
			if (typeof last === "function") {
				currentCallback = last;
				args = slice.call(args, 0, -1);
			}
			return base.apply(currentContext = this, currentArgs = args);
		}, base);
		try {
			mixin(conf.memoized, base);
		} catch (ignore) {}

		// From cache (sync)
		conf.on("get", function (id) {
			var cb, context, args;
			if (!currentCallback) return;

			// Unresolved
			if (waiting[id]) {
				if (typeof waiting[id] === "function") waiting[id] = [waiting[id], currentCallback];
				else waiting[id].push(currentCallback);
				currentCallback = null;
				return;
			}

			// Resolved, assure next tick invocation
			cb = currentCallback;
			context = currentContext;
			args = currentArgs;
			currentCallback = currentContext = currentArgs = null;
			nextTick(function () {
				var data;
				if (hasOwnProperty.call(cache, id)) {
					data = cache[id];
					conf.emit("getasync", id, args, context);
					apply.call(cb, data.context, data.args);
				} else {
					// Purged in a meantime, we shouldn't rely on cached value, recall
					currentCallback = cb;
					currentContext = context;
					currentArgs = args;
					base.apply(context, args);
				}
			});
		});

		// Not from cache
		conf.original = function () {
			var args, cb, origCb, result;
			if (!currentCallback) return apply.call(original, this, arguments);
			args = aFrom(arguments);
			cb = function self(err) {
				var cb, args, id = self.id;
				if (id == null) {
					// Shouldn't happen, means async callback was called sync way
					nextTick(apply.bind(self, this, arguments));
					return undefined;
				}
				delete self.id;
				cb = waiting[id];
				delete waiting[id];
				if (!cb) {
					// Already processed,
					// outcome of race condition: asyncFn(1, cb), asyncFn.clear(), asyncFn(1, cb)
					return undefined;
				}
				args = aFrom(arguments);
				if (conf.has(id)) {
					if (err) {
						conf.delete(id);
					} else {
						cache[id] = { context: this, args: args };
						conf.emit("setasync", id, typeof cb === "function" ? 1 : cb.length);
					}
				}
				if (typeof cb === "function") {
					result = apply.call(cb, this, args);
				} else {
					cb.forEach(function (cb) {
						result = apply.call(cb, this, args);
					}, this);
				}
				return result;
			};
			origCb = currentCallback;
			currentCallback = currentContext = currentArgs = null;
			args.push(cb);
			result = apply.call(original, this, args);
			cb.cb = origCb;
			currentCallback = cb;
			return result;
		};

		// After not from cache call
		conf.on("set", function (id) {
			if (!currentCallback) {
				conf.delete(id);
				return;
			}
			if (waiting[id]) {
				// Race condition: asyncFn(1, cb), asyncFn.clear(), asyncFn(1, cb)
				if (typeof waiting[id] === "function") waiting[id] = [waiting[id], currentCallback.cb];
				else waiting[id].push(currentCallback.cb);
			} else {
				waiting[id] = currentCallback.cb;
			}
			delete currentCallback.cb;
			currentCallback.id = id;
			currentCallback = null;
		});

		// On delete
		conf.on("delete", function (id) {
			var result;
			// If false, we don't have value yet, so we assume that intention is not
			// to memoize this call. After value is obtained we don't cache it but
			// gracefully pass to callback
			if (hasOwnProperty.call(waiting, id)) return;
			if (!cache[id]) return;
			result = cache[id];
			delete cache[id];
			conf.emit("deleteasync", id, slice.call(result.args, 1));
		});

		// On clear
		conf.on("clear", function () {
			var oldCache = cache;
			cache = create(null);
			conf.emit(
				"clearasync",
				objectMap(oldCache, function (data) {
					return slice.call(data.args, 1);
				})
			);
		});
	};


/***/ }),
/* 72 */
/***/ (function(module, exports) {

	'use strict';

	var callable, byObserver;

	callable = function (fn) {
		if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
		return fn;
	};

	byObserver = function (Observer) {
		var node = document.createTextNode(''), queue, currentQueue, i = 0;
		new Observer(function () {
			var callback;
			if (!queue) {
				if (!currentQueue) return;
				queue = currentQueue;
			} else if (currentQueue) {
				queue = currentQueue.concat(queue);
			}
			currentQueue = queue;
			queue = null;
			if (typeof currentQueue === 'function') {
				callback = currentQueue;
				currentQueue = null;
				callback();
				return;
			}
			node.data = (i = ++i % 2); // Invoke other batch, to handle leftover callbacks in case of crash
			while (currentQueue) {
				callback = currentQueue.shift();
				if (!currentQueue.length) currentQueue = null;
				callback();
			}
		}).observe(node, { characterData: true });
		return function (fn) {
			callable(fn);
			if (queue) {
				if (typeof queue === 'function') queue = [queue, fn];
				else queue.push(fn);
				return;
			}
			queue = fn;
			node.data = (i = ++i % 2);
		};
	};

	module.exports = (function () {
		// Node.js
		if ((typeof process === 'object') && process && (typeof process.nextTick === 'function')) {
			return process.nextTick;
		}

		// MutationObserver
		if ((typeof document === 'object') && document) {
			if (typeof MutationObserver === 'function') return byObserver(MutationObserver);
			if (typeof WebKitMutationObserver === 'function') return byObserver(WebKitMutationObserver);
		}

		// W3C Draft
		// http://dvcs.w3.org/hg/webperf/raw-file/tip/specs/setImmediate/Overview.html
		if (typeof setImmediate === 'function') {
			return function (cb) { setImmediate(callable(cb)); };
		}

		// Wide available standard
		if ((typeof setTimeout === 'function') || (typeof setTimeout === 'object')) {
			return function (cb) { setTimeout(callable(cb), 0); };
		}

		return null;
	}());


/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint max-statements: 0 */

	// Support for functions returning promise

	"use strict";

	var objectMap     = __webpack_require__(27)
	  , primitiveSet  = __webpack_require__(28)
	  , ensureString  = __webpack_require__(74)
	  , toShortString = __webpack_require__(76)
	  , isPromise     = __webpack_require__(78)
	  , nextTick      = __webpack_require__(72);

	var create = Object.create
	  , supportedModes = primitiveSet("then", "then:finally", "done", "done:finally");

	__webpack_require__(42).promise = function (mode, conf) {
		var waiting = create(null), cache = create(null), promises = create(null);

		if (mode === true) {
			mode = null;
		} else {
			mode = ensureString(mode);
			if (!supportedModes[mode]) {
				throw new TypeError("'" + toShortString(mode) + "' is not valid promise mode");
			}
		}

		// After not from cache call
		conf.on("set", function (id, ignore, promise) {
			var isFailed = false;

			if (!isPromise(promise)) {
				// Non promise result
				cache[id] = promise;
				conf.emit("setasync", id, 1);
				return;
			}
			waiting[id] = 1;
			promises[id] = promise;
			var onSuccess = function (result) {
				var count = waiting[id];
				if (isFailed) {
					throw new Error(
						"Memoizee error: Detected unordered then|done & finally resolution, which " +
							"in turn makes proper detection of success/failure impossible (when in " +
							"'done:finally' mode)\n" +
							"Consider to rely on 'then' or 'done' mode instead."
					);
				}
				if (!count) return; // Deleted from cache before resolved
				delete waiting[id];
				cache[id] = result;
				conf.emit("setasync", id, count);
			};
			var onFailure = function () {
				isFailed = true;
				if (!waiting[id]) return; // Deleted from cache (or succeed in case of finally)
				delete waiting[id];
				delete promises[id];
				conf.delete(id);
			};

			var resolvedMode = mode;
			if (!resolvedMode) resolvedMode = "then";

			if (resolvedMode === "then") {
				promise.then(
					function (result) {
						nextTick(onSuccess.bind(this, result));
					},
					function () {
						nextTick(onFailure);
					}
				);
			} else if (resolvedMode === "done") {
				// Not recommended, as it may mute any eventual "Unhandled error" events
				if (typeof promise.done !== "function") {
					throw new Error(
						"Memoizee error: Retrieved promise does not implement 'done' " +
							"in 'done' mode"
					);
				}
				promise.done(onSuccess, onFailure);
			} else if (resolvedMode === "done:finally") {
				// The only mode with no side effects assuming library does not throw unconditionally
				// for rejected promises.
				if (typeof promise.done !== "function") {
					throw new Error(
						"Memoizee error: Retrieved promise does not implement 'done' " +
							"in 'done:finally' mode"
					);
				}
				if (typeof promise.finally !== "function") {
					throw new Error(
						"Memoizee error: Retrieved promise does not implement 'finally' " +
							"in 'done:finally' mode"
					);
				}
				promise.done(onSuccess);
				promise.finally(onFailure);
			}
		});

		// From cache (sync)
		conf.on("get", function (id, args, context) {
			var promise;
			if (waiting[id]) {
				++waiting[id]; // Still waiting
				return;
			}
			promise = promises[id];
			var emit = function () {
				conf.emit("getasync", id, args, context);
			};
			if (isPromise(promise)) {
				if (typeof promise.done === "function") promise.done(emit);
				else {
					promise.then(function () {
						nextTick(emit);
					});
				}
			} else {
				emit();
			}
		});

		// On delete
		conf.on("delete", function (id) {
			delete promises[id];
			if (waiting[id]) {
				delete waiting[id];
				return; // Not yet resolved
			}
			if (!hasOwnProperty.call(cache, id)) return;
			var result = cache[id];
			delete cache[id];
			conf.emit("deleteasync", id, [result]);
		});

		// On clear
		conf.on("clear", function () {
			var oldCache = cache;
			cache = create(null);
			waiting = create(null);
			promises = create(null);
			conf.emit(
				"clearasync",
				objectMap(oldCache, function (data) {
					return [data];
				})
			);
		});
	};


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var ensureValue   = __webpack_require__(17)
	  , stringifiable = __webpack_require__(75);

	module.exports = function (value) {
		return stringifiable(ensureValue(value));
	};


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isCallable = __webpack_require__(19);

	module.exports = function (stringifiable) {
		try {
			if (stringifiable && isCallable(stringifiable.toString)) return stringifiable.toString();
			return String(stringifiable);
		} catch (e) {
			throw new TypeError("Passed argument cannot be stringifed");
		}
	};


/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var safeToString = __webpack_require__(77);

	var reNewLine = /[\n\r\u2028\u2029]/g;

	module.exports = function (value) {
		var string = safeToString(value);
		// Trim if too long
		if (string.length > 100) string = string.slice(0, 99) + "…";
		// Replace eventual new lines
		string = string.replace(reNewLine, function (char) {
			return JSON.stringify(char).slice(1, -1);
		});
		return string;
	};


/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isCallable = __webpack_require__(19);

	module.exports = function (value) {
		try {
			if (value && isCallable(value.toString)) return value.toString();
			return String(value);
		} catch (e) {
			return "<Non-coercible to string value>";
		}
	};


/***/ }),
/* 78 */
/***/ (function(module, exports) {

	module.exports = isPromise;

	function isPromise(obj) {
	  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
	}


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

	// Call dispose callback on each cache purge

	"use strict";

	var callable   = __webpack_require__(26)
	  , forEach    = __webpack_require__(24)
	  , extensions = __webpack_require__(42)

	  , apply = Function.prototype.apply;

	extensions.dispose = function (dispose, conf, options) {
		var del;
		callable(dispose);
		if ((options.async && extensions.async) || (options.promise && extensions.promise)) {
			conf.on("deleteasync", del = function (id, resultArray) {
				apply.call(dispose, null, resultArray);
			});
			conf.on("clearasync", function (cache) {
				forEach(cache, function (result, id) {
	 del(id, result);
	});
			});
			return;
		}
		conf.on("delete", del = function (id, result) {
	 dispose(result);
	});
		conf.on("clear", function (cache) {
			forEach(cache, function (result, id) {
	 del(id, result);
	});
		});
	};


/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

	/* eslint consistent-this: 0 */

	// Timeout cached values

	"use strict";

	var aFrom      = __webpack_require__(50)
	  , forEach    = __webpack_require__(24)
	  , nextTick   = __webpack_require__(72)
	  , isPromise  = __webpack_require__(78)
	  , timeout    = __webpack_require__(81)
	  , extensions = __webpack_require__(42);

	var noop = Function.prototype, max = Math.max, min = Math.min, create = Object.create;

	extensions.maxAge = function (maxAge, conf, options) {
		var timeouts, postfix, preFetchAge, preFetchTimeouts;

		maxAge = timeout(maxAge);
		if (!maxAge) return;

		timeouts = create(null);
		postfix =
			(options.async && extensions.async) || (options.promise && extensions.promise)
				? "async"
				: "";
		conf.on("set" + postfix, function (id) {
			timeouts[id] = setTimeout(function () {
				conf.delete(id);
			}, maxAge);
			if (typeof timeouts[id].unref === "function") timeouts[id].unref();
			if (!preFetchTimeouts) return;
			if (preFetchTimeouts[id]) {
				if (preFetchTimeouts[id] !== "nextTick") clearTimeout(preFetchTimeouts[id]);
			}
			preFetchTimeouts[id] = setTimeout(function () {
				delete preFetchTimeouts[id];
			}, preFetchAge);
			if (typeof preFetchTimeouts[id].unref === "function") preFetchTimeouts[id].unref();
		});
		conf.on("delete" + postfix, function (id) {
			clearTimeout(timeouts[id]);
			delete timeouts[id];
			if (!preFetchTimeouts) return;
			if (preFetchTimeouts[id] !== "nextTick") clearTimeout(preFetchTimeouts[id]);
			delete preFetchTimeouts[id];
		});

		if (options.preFetch) {
			if (options.preFetch === true || isNaN(options.preFetch)) {
				preFetchAge = 0.333;
			} else {
				preFetchAge = max(min(Number(options.preFetch), 1), 0);
			}
			if (preFetchAge) {
				preFetchTimeouts = {};
				preFetchAge = (1 - preFetchAge) * maxAge;
				conf.on("get" + postfix, function (id, args, context) {
					if (!preFetchTimeouts[id]) {
						preFetchTimeouts[id] = "nextTick";
						nextTick(function () {
							var result;
							if (preFetchTimeouts[id] !== "nextTick") return;
							delete preFetchTimeouts[id];
							conf.delete(id);
							if (options.async) {
								args = aFrom(args);
								args.push(noop);
							}
							result = conf.memoized.apply(context, args);
							if (options.promise) {
								// Supress eventual error warnings
								if (isPromise(result)) {
									if (typeof result.done === "function") result.done(noop, noop);
									else result.then(noop, noop);
								}
							}
						});
					}
				});
			}
		}

		conf.on("clear" + postfix, function () {
			forEach(timeouts, function (id) {
				clearTimeout(id);
			});
			timeouts = {};
			if (preFetchTimeouts) {
				forEach(preFetchTimeouts, function (id) {
					if (id !== "nextTick") clearTimeout(id);
				});
				preFetchTimeouts = {};
			}
		});
	};


/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var toPosInt   = __webpack_require__(36)
	  , maxTimeout = __webpack_require__(82);

	module.exports = function (value) {
		value = toPosInt(value);
		if (value > maxTimeout) throw new TypeError(value + " exceeds maximum possible timeout");
		return value;
	};


/***/ }),
/* 82 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = 2147483647;


/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

	// Limit cache size, LRU (least recently used) algorithm.

	"use strict";

	var toPosInteger = __webpack_require__(36)
	  , lruQueue     = __webpack_require__(84)
	  , extensions   = __webpack_require__(42);

	extensions.max = function (max, conf, options) {
		var postfix, queue, hit;

		max = toPosInteger(max);
		if (!max) return;

		queue = lruQueue(max);
		postfix = (options.async && extensions.async) || (options.promise && extensions.promise)
			? "async" : "";

		conf.on("set" + postfix, hit = function (id) {
			id = queue.hit(id);
			if (id === undefined) return;
			conf.delete(id);
		});
		conf.on("get" + postfix, hit);
		conf.on("delete" + postfix, queue.delete);
		conf.on("clear" + postfix, queue.clear);
	};


/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var toPosInt = __webpack_require__(36)

	  , create = Object.create, hasOwnProperty = Object.prototype.hasOwnProperty;

	module.exports = function (limit) {
		var size = 0, base = 1, queue = create(null), map = create(null), index = 0, del;
		limit = toPosInt(limit);
		return {
			hit: function (id) {
				var oldIndex = map[id], nuIndex = ++index;
				queue[nuIndex] = id;
				map[id] = nuIndex;
				if (!oldIndex) {
					++size;
					if (size <= limit) return;
					id = queue[base];
					del(id);
					return id;
				}
				delete queue[oldIndex];
				if (base !== oldIndex) return;
				while (!hasOwnProperty.call(queue, ++base)) continue; //jslint: skip
			},
			delete: del = function (id) {
				var oldIndex = map[id];
				if (!oldIndex) return;
				delete queue[oldIndex];
				delete map[id];
				--size;
				if (base !== oldIndex) return;
				if (!size) {
					index = 0;
					base = 1;
					return;
				}
				while (!hasOwnProperty.call(queue, ++base)) continue; //jslint: skip
			},
			clear: function () {
				size = 0;
				base = 1;
				queue = create(null);
				map = create(null);
				index = 0;
			}
		};
	};


/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

	// Reference counter, useful for garbage collector like functionality

	"use strict";

	var d          = __webpack_require__(8)
	  , extensions = __webpack_require__(42)

	  , create = Object.create, defineProperties = Object.defineProperties;

	extensions.refCounter = function (ignore, conf, options) {
		var cache, postfix;

		cache = create(null);
		postfix = (options.async && extensions.async) || (options.promise && extensions.promise)
			? "async" : "";

		conf.on("set" + postfix, function (id, length) {
	 cache[id] = length || 1;
	});
		conf.on("get" + postfix, function (id) {
	 ++cache[id];
	});
		conf.on("delete" + postfix, function (id) {
	 delete cache[id];
	});
		conf.on("clear" + postfix, function () {
	 cache = {};
	});

		defineProperties(conf.memoized, {
			deleteRef: d(function () {
				var id = conf.get(arguments);
				if (id === null) return null;
				if (!cache[id]) return null;
				if (!--cache[id]) {
					conf.delete(id);
					return true;
				}
				return false;
			}),
			getRefCount: d(function () {
				var id = conf.get(arguments);
				if (id === null) return 0;
				if (!cache[id]) return 0;
				return cache[id];
			})
		});
	};


/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(87)(__webpack_require__(34));


/***/ }),
/* 87 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var forEach       = __webpack_require__(24)
	  , normalizeOpts = __webpack_require__(18)
	  , callable      = __webpack_require__(26)
	  , lazy          = __webpack_require__(88)
	  , resolveLength = __webpack_require__(35)
	  , extensions    = __webpack_require__(42);

	module.exports = function (memoize) {
		return function (props) {
			forEach(props, function (desc) {
				var fn = callable(desc.value), length;
				desc.value = function (options) {
					if (options.getNormalizer) {
						options = normalizeOpts(options);
						if (length === undefined) {
							length = resolveLength(
								options.length,
								fn.length,
								options.async && extensions.async
							);
						}
						options.normalizer = options.getNormalizer(length);
						delete options.getNormalizer;
					}
					return memoize(fn.bind(this), options);
				};
			});
			return lazy(props);
		};
	};


/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var map        = __webpack_require__(27)
	  , isCallable = __webpack_require__(19)
	  , validValue = __webpack_require__(17)
	  , contains   = __webpack_require__(20)

	  , call = Function.prototype.call
	  , defineProperty = Object.defineProperty
	  , getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
	  , getPrototypeOf = Object.getPrototypeOf
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , cacheDesc = { configurable: false, enumerable: false, writable: false,
			value: null }
	  , define;

	define = function (name, options) {
		var value, dgs, cacheName, desc, writable = false, resolvable
		  , flat;
		options = Object(validValue(options));
		cacheName = options.cacheName;
		flat = options.flat;
		if (cacheName == null) cacheName = name;
		delete options.cacheName;
		value = options.value;
		resolvable = isCallable(value);
		delete options.value;
		dgs = { configurable: Boolean(options.configurable),
			enumerable: Boolean(options.enumerable) };
		if (name !== cacheName) {
			dgs.get = function () {
				if (hasOwnProperty.call(this, cacheName)) return this[cacheName];
				cacheDesc.value = resolvable ? call.call(value, this, options) : value;
				cacheDesc.writable = writable;
				defineProperty(this, cacheName, cacheDesc);
				cacheDesc.value = null;
				if (desc) defineProperty(this, name, desc);
				return this[cacheName];
			};
		} else if (!flat) {
			dgs.get = function self() {
				var ownDesc;
				if (hasOwnProperty.call(this, name)) {
					ownDesc = getOwnPropertyDescriptor(this, name);
					// It happens in Safari, that getter is still called after property
					// was defined with a value, following workarounds that
					// While in IE11 it may happen that here ownDesc is undefined (go figure)
					if (ownDesc) {
						if (ownDesc.hasOwnProperty('value')) return ownDesc.value;
						if ((typeof ownDesc.get === 'function') && (ownDesc.get !== self)) {
							return ownDesc.get.call(this);
						}
						return value;
					}
				}
				desc.value = resolvable ? call.call(value, this, options) : value;
				defineProperty(this, name, desc);
				desc.value = null;
				return this[name];
			};
		} else {
			dgs.get = function self() {
				var base = this, ownDesc;
				if (hasOwnProperty.call(this, name)) {
					// It happens in Safari, that getter is still called after property
					// was defined with a value, following workarounds that
					ownDesc = getOwnPropertyDescriptor(this, name);
					if (ownDesc.hasOwnProperty('value')) return ownDesc.value;
					if ((typeof ownDesc.get === 'function') && (ownDesc.get !== self)) {
						return ownDesc.get.call(this);
					}
				}
				while (!hasOwnProperty.call(base, name)) base = getPrototypeOf(base);
				desc.value = resolvable ? call.call(value, base, options) : value;
				defineProperty(base, name, desc);
				desc.value = null;
				return base[name];
			};
		}
		dgs.set = function (value) {
			if (hasOwnProperty.call(this, name)) {
				throw new TypeError("Cannot assign to lazy defined '" + name + "' property of " + this);
			}
			dgs.get.call(this);
			this[cacheName] = value;
		};
		if (options.desc) {
			desc = {
				configurable: contains.call(options.desc, 'c'),
				enumerable: contains.call(options.desc, 'e')
			};
			if (cacheName === name) {
				desc.writable = contains.call(options.desc, 'w');
				desc.value = null;
			} else {
				writable = contains.call(options.desc, 'w');
				desc.get = dgs.get;
				desc.set = dgs.set;
			}
			delete options.desc;
		} else if (cacheName === name) {
			desc = {
				configurable: Boolean(options.configurable),
				enumerable: Boolean(options.enumerable),
				writable: Boolean(options.writable),
				value: null
			};
		}
		delete options.configurable;
		delete options.enumerable;
		delete options.writable;
		return dgs;
	};

	module.exports = function (props) {
		return map(props, function (desc, name) { return define(name, desc); });
	};


/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	/* CSI - control sequence introducer */
	/* SGR - set graphic rendition */

	var assign   = __webpack_require__(9)
	  , includes = __webpack_require__(20)
	  , forOwn   = __webpack_require__(24)
	  , onlyKey  = __webpack_require__(90)
	  , forEachRight = __webpack_require__(91)
	  , uniq = __webpack_require__(92);

	var CSI = '\x1b[';

	var sgr = function (code) {
		return CSI + code + 'm';
	};

	sgr.CSI = CSI;

	var mods = assign({
		// Style
		bold:      { _bold: [1, 22] },
		italic:    { _italic: [3, 23] },
		underline: { _underline: [4, 24] },
		blink:     { _blink: [5, 25] },
		inverse:   { _inverse: [7, 27] },
		strike:    { _strike: [9, 29] }

		// Color
	}, ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
		.reduce(function (obj, color, index) {
			// foreground
			obj[color] = { _fg: [30 + index, 39] };
			obj[color + 'Bright'] = { _fg: [90 + index, 39] };

			// background
			obj['bg' + color[0].toUpperCase() + color.slice(1)] = { _bg: [40 + index, 49] };
			obj['bg' + color[0].toUpperCase() + color.slice(1) + 'Bright'] = { _bg: [100 + index, 49] };

			return obj;
		}, {}));

	sgr.mods = mods;

	sgr.openers = {};
	sgr.closers = {};

	forOwn(mods, function (mod) {
		var modPair = mod[onlyKey(mod)];

		sgr.openers[modPair[0]] = modPair;
		sgr.closers[modPair[1]] = modPair;
	});

	sgr.openStyle = function (mods, code) {
		mods.push(sgr.openers[code]);
	};

	sgr.closeStyle = function (mods, code) {
		forEachRight.call(mods, function (modPair, index) {
			if (modPair[1] === code) {
				mods.splice(index, 1);
			}
		});
	};

	/* prepend openers */
	sgr.prepend = function (mods) {
		return mods.map(function (modPair, key) {
			return sgr(modPair[0]);
		});
	};

	/* complete non-closed openers with corresponding closers */
	sgr.complete = function (mods, closerCodes) {
		closerCodes.forEach(function (code) {
			sgr.closeStyle(mods, code);
		});

		// mods must be closed from the last opened to first opened
		mods = mods.reverse();

		mods = mods.map(function (modPair, key) {
			return modPair[1];
		});

		// one closer can close many openers (31, 32 -> 39)
		mods = uniq.call(mods);

		return mods.map(sgr);
	};

	var hasCSI = function (str) {
		return includes.call(str, CSI);
	};

	sgr.hasCSI = hasCSI;

	var extractCode = function (csi) {
		var code = csi.slice(2, -1);
		code = Number(code);
		return code;
	};

	sgr.extractCode = extractCode;

	module.exports = sgr;


/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var value                   = __webpack_require__(17)
	  , objPropertyIsEnumerable = Object.prototype.propertyIsEnumerable;

	module.exports = function (obj) {
		var i;
		value(obj);
		for (i in obj) {
			if (objPropertyIsEnumerable.call(obj, i)) return i;
		}
		return null;
	};


/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var toPosInt          = __webpack_require__(36)
	  , callable          = __webpack_require__(26)
	  , value             = __webpack_require__(17)
	  , objHasOwnProperty = Object.prototype.hasOwnProperty
	  , call              = Function.prototype.call;

	module.exports = function (cb /*, thisArg*/) {
		var i, self, thisArg;

		self = Object(value(this));
		callable(cb);
		thisArg = arguments[1];

		for (i = toPosInt(self.length) - 1; i >= 0; --i) {
			if (objHasOwnProperty.call(self, i)) call.call(cb, thisArg, self[i], i, self);
		}
	};


/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var indexOf = __webpack_require__(65)

	  , filter = Array.prototype.filter

	  , isFirst;

	isFirst = function (value, index) {
		return indexOf.call(this, value) === index;
	};

	module.exports = function () {
	 return filter.call(this, isFirst, this);
	};


/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var push = Array.prototype.push, reduce = Array.prototype.reduce, abs = Math.abs
	  , colors, match, result, i;

	colors = __webpack_require__(94).map(function (color) {
		return {
			r: parseInt(color.slice(0, 2), 16),
			g: parseInt(color.slice(2, 4), 16),
			b: parseInt(color.slice(4), 16)
		};
	});

	match = colors.slice(0, 16);

	module.exports = result = [];

	i = 0;
	while (i < 8) {
		result.push(30 + i++);
	}
	i = 0;
	while (i < 8) {
		result.push(90 + i++);
	}
	push.apply(result, colors.slice(16).map(function (data) {
		var index, diff = Infinity;
		match.every(function (match, i) {
			var ndiff = reduce.call('rgb', function (diff, channel) {
				diff += abs(match[channel] - data[channel]);
				return diff;
			}, 0);
			if (ndiff < diff) {
				index = i;
				diff = ndiff;
			}
			return ndiff;
		});
		return result[index];
	}));


/***/ }),
/* 94 */
/***/ (function(module, exports) {

	'use strict';

	module.exports = [
		"000000", "800000", "008000", "808000", "000080", "800080", "008080", "c0c0c0",
		"808080", "ff0000", "00ff00", "ffff00", "0000ff", "ff00ff", "00ffff", "ffffff",

		"000000", "00005f", "000087", "0000af", "0000d7", "0000ff",
		"005f00", "005f5f", "005f87", "005faf", "005fd7", "005fff",
		"008700", "00875f", "008787", "0087af", "0087d7", "0087ff",
		"00af00", "00af5f", "00af87", "00afaf", "00afd7", "00afff",
		"00d700", "00d75f", "00d787", "00d7af", "00d7d7", "00d7ff",
		"00ff00", "00ff5f", "00ff87", "00ffaf", "00ffd7", "00ffff",

		"5f0000", "5f005f", "5f0087", "5f00af", "5f00d7", "5f00ff",
		"5f5f00", "5f5f5f", "5f5f87", "5f5faf", "5f5fd7", "5f5fff",
		"5f8700", "5f875f", "5f8787", "5f87af", "5f87d7", "5f87ff",
		"5faf00", "5faf5f", "5faf87", "5fafaf", "5fafd7", "5fafff",
		"5fd700", "5fd75f", "5fd787", "5fd7af", "5fd7d7", "5fd7ff",
		"5fff00", "5fff5f", "5fff87", "5fffaf", "5fffd7", "5fffff",

		"870000", "87005f", "870087", "8700af", "8700d7", "8700ff",
		"875f00", "875f5f", "875f87", "875faf", "875fd7", "875fff",
		"878700", "87875f", "878787", "8787af", "8787d7", "8787ff",
		"87af00", "87af5f", "87af87", "87afaf", "87afd7", "87afff",
		"87d700", "87d75f", "87d787", "87d7af", "87d7d7", "87d7ff",
		"87ff00", "87ff5f", "87ff87", "87ffaf", "87ffd7", "87ffff",

		"af0000", "af005f", "af0087", "af00af", "af00d7", "af00ff",
		"af5f00", "af5f5f", "af5f87", "af5faf", "af5fd7", "af5fff",
		"af8700", "af875f", "af8787", "af87af", "af87d7", "af87ff",
		"afaf00", "afaf5f", "afaf87", "afafaf", "afafd7", "afafff",
		"afd700", "afd75f", "afd787", "afd7af", "afd7d7", "afd7ff",
		"afff00", "afff5f", "afff87", "afffaf", "afffd7", "afffff",

		"d70000", "d7005f", "d70087", "d700af", "d700d7", "d700ff",
		"d75f00", "d75f5f", "d75f87", "d75faf", "d75fd7", "d75fff",
		"d78700", "d7875f", "d78787", "d787af", "d787d7", "d787ff",
		"d7af00", "d7af5f", "d7af87", "d7afaf", "d7afd7", "d7afff",
		"d7d700", "d7d75f", "d7d787", "d7d7af", "d7d7d7", "d7d7ff",
		"d7ff00", "d7ff5f", "d7ff87", "d7ffaf", "d7ffd7", "d7ffff",

		"ff0000", "ff005f", "ff0087", "ff00af", "ff00d7", "ff00ff",
		"ff5f00", "ff5f5f", "ff5f87", "ff5faf", "ff5fd7", "ff5fff",
		"ff8700", "ff875f", "ff8787", "ff87af", "ff87d7", "ff87ff",
		"ffaf00", "ffaf5f", "ffaf87", "ffafaf", "ffafd7", "ffafff",
		"ffd700", "ffd75f", "ffd787", "ffd7af", "ffd7d7", "ffd7ff",
		"ffff00", "ffff5f", "ffff87", "ffffaf", "ffffd7", "ffffff",

		"080808", "121212", "1c1c1c", "262626", "303030", "3a3a3a",
		"444444", "4e4e4e", "585858", "626262", "6c6c6c", "767676",
		"808080", "8a8a8a", "949494", "9e9e9e", "a8a8a8", "b2b2b2",
		"bcbcbc", "c6c6c6", "d0d0d0", "dadada", "e4e4e4", "eeeeee"
	];


/***/ }),
/* 95 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var d = __webpack_require__(8);

	Object.defineProperties(exports, {
		width: d.gs('ce', function () { return process.stdout.columns || 0; }),
		height: d.gs('ce', function () { return process.stdout.rows || 0; })
	});


/***/ }),
/* 96 */
/***/ (function(module, exports) {

	'use strict';

	module.exports = {
		screen: '\x1b[2J',
		screenLeft: '\x1b[1J',
		screenRight: '\x1b[J',
		line: '\x1b[2K',
		lineLeft: '\x1b[1K',
		lineRight: '\x1b[K'
	};


/***/ }),
/* 97 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var d     = __webpack_require__(8)
	  , trunc = __webpack_require__(98)

	  , up, down, right, left
	  , abs = Math.abs, floor = Math.floor, max = Math.max;

	var getMove = function (control) {
		return function (num) {
			num = isNaN(num) ? 0 : max(floor(num), 0);
			return num ? ('\x1b[' + num + control) : '';
		};
	};
	module.exports = Object.defineProperties(function (x, y) {
		x = isNaN(x) ? 0 : floor(x);
		y = isNaN(y) ? 0 : floor(y);
		return ((x > 0) ? right(x) : left(-x)) + ((y > 0) ? down(y) : up(-y));
	}, {
		up: d(up = getMove('A')),
		down: d(down = getMove('B')),
		right: d(right = getMove('C')),
		left: d(left = getMove('D')),
		to: d(function (x, y) {
			x = isNaN(x) ? 1 : (max(floor(x), 0) + 1);
			y = isNaN(y) ? 1 : (max(floor(y), 0) + 1);
			return '\x1b[' + y + ';' + x + 'H';
		}),
		lines: d(function (n) {
			var dir;
			n = trunc(n) || 0;
			dir = (n >= 0) ? 'E' : 'F';
			n = floor(abs(n));
			return '\x1b[' + n + dir;
		})
	});


/***/ }),
/* 98 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(99)()
		? Math.trunc
		: __webpack_require__(100);


/***/ }),
/* 99 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function () {
		var trunc = Math.trunc;
		if (typeof trunc !== "function") return false;
		return (trunc(13.67) === 13) && (trunc(-13.67) === -13);
	};


/***/ }),
/* 100 */
/***/ (function(module, exports) {

	"use strict";

	var floor = Math.floor;

	module.exports = function (value) {
		if (isNaN(value)) return NaN;
		value = Number(value);
		if (value === 0) return value;
		if (value === Infinity) return Infinity;
		if (value === -Infinity) return -Infinity;
		if (value > 0) return floor(value);
		return -floor(-value);
	};


/***/ }),
/* 101 */
/***/ (function(module, exports) {

	'use strict';

	module.exports = '\x07';


/***/ }),
/* 102 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var from              = __webpack_require__(50)
	  , iterable          = __webpack_require__(103)
	  , stringifiable     = __webpack_require__(75)
	  , repeat            = __webpack_require__(106)
	  , getStrippedLength = __webpack_require__(109);

	module.exports = function (rows/*, options*/) {
		var options = Object(arguments[1]), cols = []
		  , colsOptions = options.columns || [];
		return from(iterable(rows), function (row, index) {
			return from(iterable(row), function (str, index) {
				var col = cols[index], strLength;
				if (!col) col = cols[index] = { width: 0 };
				str = stringifiable(str);
				strLength = getStrippedLength(str);
				if (strLength > col.width) col.width = strLength;
				return { str: str, length: strLength };
			});
		}).map(function (row) {
			return row.map(function (item, index) {
				var pad, align = 'left', colOptions = colsOptions && colsOptions[index];
				align = (colOptions && (colOptions.align === 'right')) ? 'right' : 'left';
				pad = repeat.call(' ', cols[index].width - item.length);
				if (align === 'left') return item.str + pad;
				return pad + item.str;
			}).join((options.sep == null) ? ' | ' : options.sep);
		}).join('\n') + '\n';
	};


/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isObject = __webpack_require__(32)
	  , is       = __webpack_require__(104);

	module.exports = function (value) {
		if (is(value) && isObject(value)) return value;
		throw new TypeError(value + " is not an iterable or array-like object");
	};


/***/ }),
/* 104 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var iteratorSymbol = __webpack_require__(53).iterator
	  , isValue        = __webpack_require__(15)
	  , isArrayLike    = __webpack_require__(105);

	module.exports = function (value) {
		if (!isValue(value)) return false;
		if (typeof value[iteratorSymbol] === "function") return true;
		return isArrayLike(value);
	};


/***/ }),
/* 105 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isFunction = __webpack_require__(59)
	  , isObject   = __webpack_require__(32)
	  , isValue    = __webpack_require__(15);

	module.exports = function (value) {
		return (
			(isValue(value) &&
				typeof value.length === "number" &&
				// Just checking ((typeof x === 'object') && (typeof x !== 'function'))
				// won't work right for some cases, e.g.:
				// type of instance of NodeList in Safari is a 'function'
				((isObject(value) && !isFunction(value)) || typeof value === "string")) ||
			false
		);
	};


/***/ }),
/* 106 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	module.exports = __webpack_require__(107)()
		? String.prototype.repeat
		: __webpack_require__(108);


/***/ }),
/* 107 */
/***/ (function(module, exports) {

	"use strict";

	var str = "foo";

	module.exports = function () {
		if (typeof str.repeat !== "function") return false;
		return str.repeat(2) === "foofoo";
	};


/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

	// Thanks
	// @rauchma http://www.2ality.com/2014/01/efficient-string-repeat.html
	// @mathiasbynens https://github.com/mathiasbynens/String.prototype.repeat/blob/4a4b567def/repeat.js

	"use strict";

	var value     = __webpack_require__(17)
	  , toInteger = __webpack_require__(37);

	module.exports = function (count) {
		var str = String(value(this)), result;
		count = toInteger(count);
		if (count < 0) throw new RangeError("Count must be >= 0");
		if (!isFinite(count)) throw new RangeError("Count must be < ∞");

		result = "";
		while (count) {
			if (count % 2) result += str;
			if (count > 1) str += str;
			// eslint-disable-next-line no-bitwise
			count >>= 1;
		}
		return result;
	};


/***/ }),
/* 109 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	/*
	 * get actual length of ANSI-formatted string
	 */

	var strip = __webpack_require__(110);

	module.exports = function (str) {
		return strip(str).length;
	};


/***/ }),
/* 110 */
/***/ (function(module, exports, __webpack_require__) {

	// Strip ANSI formatting from string

	'use strict';

	var stringifiable = __webpack_require__(75)
	  , r             = __webpack_require__(111)();

	module.exports = function (str) { return stringifiable(str).replace(r, ''); };


/***/ }),
/* 111 */
/***/ (function(module, exports) {

	'use strict';
	module.exports = function () {
		return /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g;
	};


/***/ }),
/* 112 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var reAnsi        = __webpack_require__(111)
	  , stringifiable = __webpack_require__(74)
	  , length        = __webpack_require__(109)
	  , sgr           = __webpack_require__(89)

	  , max = Math.max;

	var Token = function Token(token) {
		this.token = token;
	};

	var tokenize = function (str) {
		var match = reAnsi().exec(str);

		if (!match) {
			return [ str ];
		}

		var index = match.index
		  , head, prehead, tail;

		if (index === 0) {
			head = match[0];
			tail = str.slice(head.length);

			return [ new Token(head) ].concat(tokenize(tail));
		}

		prehead = str.slice(0, index);
		head = match[0];
		tail = str.slice(index + head.length);

		return [ prehead, new Token(head) ].concat(tokenize(tail));
	};

	var isChunkInSlice = function (chunk, index, begin, end) {
		var endIndex = chunk.length + index;

		if (begin > endIndex) return false;
		if (end < index) return false;
		return true;
	};

	var sliceSeq = function (seq, begin, end) {
		var sliced = seq.reduce(function (state, chunk) {
			var index = state.index;

			if (!(chunk instanceof Token)) {
				var nextChunk = '';

				if (isChunkInSlice(chunk, index, begin, end)) {
					var relBegin = Math.max(begin - index, 0)
					  , relEnd   = Math.min(end - index, chunk.length);

					nextChunk = chunk.slice(relBegin, relEnd);
				}

				state.seq.push(nextChunk);
				state.index = index + chunk.length;
			} else {
				var code = sgr.extractCode(chunk.token);

				if (index <= begin) {
					if (code in sgr.openers) {
						sgr.openStyle(state.preOpeners, code);
					}
					if (code in sgr.closers) {
						sgr.closeStyle(state.preOpeners, code);
					}
				} else if (index < end) {
					if (code in sgr.openers) {
						sgr.openStyle(state.inOpeners, code);
						state.seq.push(chunk);
					} else if (code in sgr.closers) {
						state.inClosers.push(code);
						state.seq.push(chunk);
					}
				}
			}

			return state;
		}, {
			index: 0,
			seq: [],

			// preOpeners -> [ mod ]
			// preOpeners must be prepended to the slice if they wasn't closed til the end of it
			// preOpeners must be closed if they wasn't closed til the end of the slice
			preOpeners: [],

			// inOpeners  -> [ mod ]
			// inOpeners already in the slice and must not be prepended to the slice
			// inOpeners must be closed if they wasn't closed til the end of the slice
			inOpeners:  [], // opener CSI inside slice

			// inClosers -> [ code ]
			// closer CSIs for determining which pre/in-Openers must be closed
			inClosers:  []
		});

		sliced.seq = [].concat(
			sgr.prepend(sliced.preOpeners),
			sliced.seq,
			sgr.complete([].concat(sliced.preOpeners, sliced.inOpeners), sliced.inClosers)
		);

		return sliced.seq;
	};

	module.exports = function (str/*, begin, end*/) {
		var seq, begin = Number(arguments[1]), end = Number(arguments[2]), len;

		str = stringifiable(str);
		len = length(str);

		if (isNaN(begin)) {
			begin = 0;
		}
		if (isNaN(end)) {
			end = len;
		}
		if (begin < 0) {
			begin = max(len + begin, 0);
		}
		if (end < 0) {
			end = max(len + end, 0);
		}

		seq = tokenize(str);
		seq = sliceSeq(seq, begin, end);
		return seq.map(function (chunk) {
			if (chunk instanceof Token) {
				return chunk.token;
			}

			return chunk;
		}).join('');
	};


/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var compose      = __webpack_require__(114)
	  , callable     = __webpack_require__(26)
	  , d            = __webpack_require__(8)
	  , validTimeout = __webpack_require__(81)

	  , chars = '-\\|/', l = chars.length, ThrobberIterator;

	ThrobberIterator = function () {};
	Object.defineProperties(ThrobberIterator.prototype, {
		index: d(-1),
		running: d(false),
		next: d(function () {
			var str = this.running ? '\u0008' : '';
			if (!this.running) this.running = true;
			return str + chars[this.index = ((this.index + 1) % l)];
		}),
		reset: d(function () {
			if (!this.running) return '';
			this.index = -1;
			this.running = false;
			return '\u0008';
		})
	});

	module.exports = exports = function (write, interval/*, format*/) {
		var format = arguments[2], token, iterator = new ThrobberIterator();
		callable(write);
		interval = validTimeout(interval);
		if (format !== undefined) write = compose.call(write, callable(format));
		return {
			start: function () {
				if (token) return;
				token = setInterval(function () { write(iterator.next()); }, interval);
			},
			restart: function () {
				this.stop();
				this.start();
			},
			stop: function () {
				if (!token) return;
				clearInterval(token);
				token = null;
				write(iterator.reset());
			}
		};
	};

	Object.defineProperty(exports, 'Iterator', d(ThrobberIterator));


/***/ }),
/* 114 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var callable = __webpack_require__(26)
	  , aFrom    = __webpack_require__(50)
	  , apply    = Function.prototype.apply
	  , call     = Function.prototype.call
	  , callFn   = function (arg, fn) {
		return call.call(fn, this, arg);
	};

	module.exports = function (fn /*, …fnn*/) {
		var fns, first;
		if (!fn) callable(fn);
		fns = [this].concat(aFrom(arguments));
		fns.forEach(callable);
		fns = fns.reverse();
		first = fns[0];
		fns = fns.slice(1);
		return function (argIgnored) {
			return fns.reduce(callFn, apply.call(first, this, arguments));
		};
	};


/***/ }),
/* 115 */
/***/ (function(module, exports) {

	'use strict';

	module.exports = '\x1b[2J\x1b[0;0H';


/***/ }),
/* 116 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var object        = __webpack_require__(117)
	  , stringifiable = __webpack_require__(74)
	  , forOf         = __webpack_require__(118);

	module.exports = function (text, style) {
		var result = '';
		text = stringifiable(text);
		object(style);
		forOf(text, function (char) { result += style[char] || char; });
		return result;
	};


/***/ }),
/* 117 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isObject = __webpack_require__(32);

	module.exports = function (value) {
		if (!isObject(value)) throw new TypeError(value + " is not an Object");
		return value;
	};


/***/ }),
/* 118 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isArguments = __webpack_require__(58)
	  , callable    = __webpack_require__(26)
	  , isString    = __webpack_require__(60)
	  , get         = __webpack_require__(119);

	var isArray = Array.isArray, call = Function.prototype.call, some = Array.prototype.some;

	module.exports = function (iterable, cb /*, thisArg*/) {
		var mode, thisArg = arguments[2], result, doBreak, broken, i, length, char, code;
		if (isArray(iterable) || isArguments(iterable)) mode = "array";
		else if (isString(iterable)) mode = "string";
		else iterable = get(iterable);

		callable(cb);
		doBreak = function () {
			broken = true;
		};
		if (mode === "array") {
			some.call(iterable, function (value) {
				call.call(cb, thisArg, value, doBreak);
				return broken;
			});
			return;
		}
		if (mode === "string") {
			length = iterable.length;
			for (i = 0; i < length; ++i) {
				char = iterable[i];
				if (i + 1 < length) {
					code = char.charCodeAt(0);
					if (code >= 0xd800 && code <= 0xdbff) char += iterable[++i];
				}
				call.call(cb, thisArg, char, doBreak);
				if (broken) break;
			}
			return;
		}
		result = iterable.next();

		while (!result.done) {
			call.call(cb, thisArg, result.value, doBreak);
			if (broken) return;
			result = iterable.next();
		}
	};


/***/ }),
/* 119 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isArguments    = __webpack_require__(58)
	  , isString       = __webpack_require__(60)
	  , ArrayIterator  = __webpack_require__(120)
	  , StringIterator = __webpack_require__(125)
	  , iterable       = __webpack_require__(126)
	  , iteratorSymbol = __webpack_require__(53).iterator;

	module.exports = function (obj) {
		if (typeof iterable(obj)[iteratorSymbol] === "function") return obj[iteratorSymbol]();
		if (isArguments(obj)) return new ArrayIterator(obj);
		if (isString(obj)) return new StringIterator(obj);
		return new ArrayIterator(obj);
	};


/***/ }),
/* 120 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var setPrototypeOf = __webpack_require__(29)
	  , contains       = __webpack_require__(20)
	  , d              = __webpack_require__(8)
	  , Symbol         = __webpack_require__(53)
	  , Iterator       = __webpack_require__(121);

	var defineProperty = Object.defineProperty, ArrayIterator;

	ArrayIterator = module.exports = function (arr, kind) {
		if (!(this instanceof ArrayIterator)) throw new TypeError("Constructor requires 'new'");
		Iterator.call(this, arr);
		if (!kind) kind = "value";
		else if (contains.call(kind, "key+value")) kind = "key+value";
		else if (contains.call(kind, "key")) kind = "key";
		else kind = "value";
		defineProperty(this, "__kind__", d("", kind));
	};
	if (setPrototypeOf) setPrototypeOf(ArrayIterator, Iterator);

	// Internal %ArrayIteratorPrototype% doesn't expose its constructor
	delete ArrayIterator.prototype.constructor;

	ArrayIterator.prototype = Object.create(Iterator.prototype, {
		_resolve: d(function (i) {
			if (this.__kind__ === "value") return this.__list__[i];
			if (this.__kind__ === "key+value") return [i, this.__list__[i]];
			return i;
		})
	});
	defineProperty(ArrayIterator.prototype, Symbol.toStringTag, d("c", "Array Iterator"));


/***/ }),
/* 121 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var clear    = __webpack_require__(122)
	  , assign   = __webpack_require__(9)
	  , callable = __webpack_require__(26)
	  , value    = __webpack_require__(17)
	  , d        = __webpack_require__(8)
	  , autoBind = __webpack_require__(123)
	  , Symbol   = __webpack_require__(53);

	var defineProperty = Object.defineProperty, defineProperties = Object.defineProperties, Iterator;

	module.exports = Iterator = function (list, context) {
		if (!(this instanceof Iterator)) throw new TypeError("Constructor requires 'new'");
		defineProperties(this, {
			__list__: d("w", value(list)),
			__context__: d("w", context),
			__nextIndex__: d("w", 0)
		});
		if (!context) return;
		callable(context.on);
		context.on("_add", this._onAdd);
		context.on("_delete", this._onDelete);
		context.on("_clear", this._onClear);
	};

	// Internal %IteratorPrototype% doesn't expose its constructor
	delete Iterator.prototype.constructor;

	defineProperties(
		Iterator.prototype,
		assign(
			{
				_next: d(function () {
					var i;
					if (!this.__list__) return undefined;
					if (this.__redo__) {
						i = this.__redo__.shift();
						if (i !== undefined) return i;
					}
					if (this.__nextIndex__ < this.__list__.length) return this.__nextIndex__++;
					this._unBind();
					return undefined;
				}),
				next: d(function () {
					return this._createResult(this._next());
				}),
				_createResult: d(function (i) {
					if (i === undefined) return { done: true, value: undefined };
					return { done: false, value: this._resolve(i) };
				}),
				_resolve: d(function (i) {
					return this.__list__[i];
				}),
				_unBind: d(function () {
					this.__list__ = null;
					delete this.__redo__;
					if (!this.__context__) return;
					this.__context__.off("_add", this._onAdd);
					this.__context__.off("_delete", this._onDelete);
					this.__context__.off("_clear", this._onClear);
					this.__context__ = null;
				}),
				toString: d(function () {
					return "[object " + (this[Symbol.toStringTag] || "Object") + "]";
				})
			},
			autoBind({
				_onAdd: d(function (index) {
					if (index >= this.__nextIndex__) return;
					++this.__nextIndex__;
					if (!this.__redo__) {
						defineProperty(this, "__redo__", d("c", [index]));
						return;
					}
					this.__redo__.forEach(function (redo, i) {
						if (redo >= index) this.__redo__[i] = ++redo;
					}, this);
					this.__redo__.push(index);
				}),
				_onDelete: d(function (index) {
					var i;
					if (index >= this.__nextIndex__) return;
					--this.__nextIndex__;
					if (!this.__redo__) return;
					i = this.__redo__.indexOf(index);
					if (i !== -1) this.__redo__.splice(i, 1);
					this.__redo__.forEach(function (redo, j) {
						if (redo > index) this.__redo__[j] = --redo;
					}, this);
				}),
				_onClear: d(function () {
					if (this.__redo__) clear.call(this.__redo__);
					this.__nextIndex__ = 0;
				})
			})
		)
	);

	defineProperty(
		Iterator.prototype,
		Symbol.iterator,
		d(function () {
			return this;
		})
	);


/***/ }),
/* 122 */
/***/ (function(module, exports, __webpack_require__) {

	// Inspired by Google Closure:
	// http://closure-library.googlecode.com/svn/docs/
	// closure_goog_array_array.js.html#goog.array.clear

	"use strict";

	var value = __webpack_require__(17);

	module.exports = function () {
		value(this).length = 0;
		return this;
	};


/***/ }),
/* 123 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var copy             = __webpack_require__(124)
	  , normalizeOptions = __webpack_require__(18)
	  , ensureCallable   = __webpack_require__(26)
	  , map              = __webpack_require__(27)
	  , callable         = __webpack_require__(26)
	  , validValue       = __webpack_require__(17)

	  , bind = Function.prototype.bind, defineProperty = Object.defineProperty
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , define;

	define = function (name, desc, options) {
		var value = validValue(desc) && callable(desc.value), dgs;
		dgs = copy(desc);
		delete dgs.writable;
		delete dgs.value;
		dgs.get = function () {
			if (!options.overwriteDefinition && hasOwnProperty.call(this, name)) return value;
			desc.value = bind.call(value, options.resolveContext ? options.resolveContext(this) : this);
			defineProperty(this, name, desc);
			return this[name];
		};
		return dgs;
	};

	module.exports = function (props/*, options*/) {
		var options = normalizeOptions(arguments[1]);
		if (options.resolveContext != null) ensureCallable(options.resolveContext);
		return map(props, function (desc, name) { return define(name, desc, options); });
	};


/***/ }),
/* 124 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var aFrom  = __webpack_require__(50)
	  , assign = __webpack_require__(9)
	  , value  = __webpack_require__(17);

	module.exports = function (obj/*, propertyNames, options*/) {
		var copy = Object(value(obj)), propertyNames = arguments[1], options = Object(arguments[2]);
		if (copy !== obj && !propertyNames) return copy;
		var result = {};
		if (propertyNames) {
			aFrom(propertyNames, function (propertyName) {
				if (options.ensure || propertyName in obj) result[propertyName] = obj[propertyName];
			});
		} else {
			assign(result, obj);
		}
		return result;
	};


/***/ }),
/* 125 */
/***/ (function(module, exports, __webpack_require__) {

	// Thanks @mathiasbynens
	// http://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols

	"use strict";

	var setPrototypeOf = __webpack_require__(29)
	  , d              = __webpack_require__(8)
	  , Symbol         = __webpack_require__(53)
	  , Iterator       = __webpack_require__(121);

	var defineProperty = Object.defineProperty, StringIterator;

	StringIterator = module.exports = function (str) {
		if (!(this instanceof StringIterator)) throw new TypeError("Constructor requires 'new'");
		str = String(str);
		Iterator.call(this, str);
		defineProperty(this, "__length__", d("", str.length));
	};
	if (setPrototypeOf) setPrototypeOf(StringIterator, Iterator);

	// Internal %ArrayIteratorPrototype% doesn't expose its constructor
	delete StringIterator.prototype.constructor;

	StringIterator.prototype = Object.create(Iterator.prototype, {
		_next: d(function () {
			if (!this.__list__) return undefined;
			if (this.__nextIndex__ < this.__length__) return this.__nextIndex__++;
			this._unBind();
			return undefined;
		}),
		_resolve: d(function (i) {
			var char = this.__list__[i], code;
			if (this.__nextIndex__ === this.__length__) return char;
			code = char.charCodeAt(0);
			if (code >= 0xd800 && code <= 0xdbff) return char + this.__list__[this.__nextIndex__++];
			return char;
		})
	});
	defineProperty(StringIterator.prototype, Symbol.toStringTag, d("c", "String Iterator"));


/***/ }),
/* 126 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isIterable = __webpack_require__(127);

	module.exports = function (value) {
		if (!isIterable(value)) throw new TypeError(value + " is not iterable");
		return value;
	};


/***/ }),
/* 127 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var isArguments = __webpack_require__(58)
	  , isValue     = __webpack_require__(15)
	  , isString    = __webpack_require__(60);

	var iteratorSymbol = __webpack_require__(53).iterator
	  , isArray        = Array.isArray;

	module.exports = function (value) {
		if (!isValue(value)) return false;
		if (isArray(value)) return true;
		if (isString(value)) return true;
		if (isArguments(value)) return true;
		return typeof value[iteratorSymbol] === "function";
	};


/***/ }),
/* 128 */
/***/ (function(module, exports) {

	"use strict";

	var FunctionsConstants = {
	    '=':            0, // DO NOT CHANGE THIS CONSTANT. Engine behavior depends on it
	    'RANGE':        1, // DO NOT CHANGE THIS CONSTANT. Engine behavior depends on it
	    'OFFSET':       2, // DO NOT CHANGE THIS CONSTANT. Engine behavior depends on it
	    '+':            3,
	    '-':            4,
	    '*':            5,
	    '/':            6,
	    '^':            7,
	    'POWER':        7,
	    '>':            8,
	    '<':            9,
	    '>=':           10,
	    '<=':           11,
	    '<>':           12,
	    'IF':           13,
	    'SUM':          14,
	    'CHOOSE':       15,
	    'AND':          16,
	    'EQ':           17,
	    'PV':           18,
	    'VLOOKUP':      19,
	    'ABS':          20,
	    'AVERAGE':      21,
	    'CONCATENATE':  22,
	    'COUNTIF':      23,
	    'SUMIF':        24,
	    'LN':           25,
	    'MAX':          26,
	    'MIN':          27,
	    'N':            28,
	    'OR':           29,
	    'RAND':         30,
	    'ROUND':        31,
	    'SQRT':         32,
	    'SUMPRODUCT':   33,
	    'T':            34,
	    'COUNTBLANK':   35,
	    'EXP':          36,
	    'PRODUCT':      37,
	    'LOOKUP':       38,
	    'BETAINV':      39,
	    'NORMINV':      40,
	    'RANK':         41,
	    'RANK.EQ':      42,
	    'RANK.AVG':     43,
	    'SMALL':        44,
	    'TEXT':         45,
	    'NORMSINV':     46,
	    'LOGINV':       47,
	    'LOGNORM.INV':  48,
	    'GAMMAINV':     49,
	    'FLOOR':        50,
	    'HLOOKUP':      51,
	    'ISERROR':      52,
	    'FIXED':        53,
	    'CHAR':         54,
	    'INDEX':        55,
	    'SEARCH':       56,
	    'CELL':         57,
	    'MID':          58,
	    'ROUNDUP':      59,
	    'ROUNDDOWN':    60,
	    'MATCH':        61,
	    'COUNTA':       62,
	    'IFERROR':      63,
	    'newrand':      64, // Apixaban
	    'rangeName':    65, // Apixaban
	    'rangeAddress': 66, // Apixaban
	    'ISBLANK':      67,
	    'ISNUMBER':     68,
	    'IFNA':         69,
	    'NORM.INV':     73,
	    'LARGE':        70,
	    'LEN' :         72,
	    'MEDIAN':       71
	};
	global.FunctionsConstants = FunctionsConstants;

	module.exports = FunctionsConstants;


/***/ }),
/* 129 */
/***/ (function(module, exports) {

	'use strict';

	function XJSRangeBase() { }

	XJSRangeBase.prototype = {
	    dump: function() {
	        var rangeData = [];
	        var max = 20;
	        var i   = 0;

	        outer:
	        for (var colNum = 0; colNum < this.colCount; colNum++) {
	            var colData = [];
	            rangeData.push(colData);
	            for (var rowNum = 0; rowNum < this.rowCount; rowNum++) {
	                var value = this.getRangeValue(colNum, rowNum);
	                if (i++ > max) {
	                    break outer;
	                }

	                colData.push(value);
	            }
	        }

	        return '[' + rangeData.map(function(colData) {
	            return '[' + colData.join(', ') + ']';
	        }).join(', ') + ']';
	    }
	};


	module.exports = XJSRangeBase;

/***/ }),
/* 130 */
/***/ (function(module, exports) {

	/**
	sprintf() for JavaScript 0.7-beta1
	http://www.diveintojavascript.com/projects/javascript-sprintf

	Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
	All rights reserved.

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:
	    * Redistributions of source code must retain the above copyright
	      notice, this list of conditions and the following disclaimer.
	    * Redistributions in binary form must reproduce the above copyright
	      notice, this list of conditions and the following disclaimer in the
	      documentation and/or other materials provided with the distribution.
	    * Neither the name of sprintf() for JavaScript nor the
	      names of its contributors may be used to endorse or promote products
	      derived from this software without specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
	DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
	ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


	Changelog:
	2010.11.07 - 0.7-beta1-node
	  - converted it to a node.js compatible module

	2010.09.06 - 0.7-beta1
	  - features: vsprintf, support for named placeholders
	  - enhancements: format cache, reduced global namespace pollution

	2010.05.22 - 0.6:
	 - reverted to 0.4 and fixed the bug regarding the sign of the number 0
	 Note:
	 Thanks to Raphael Pigulla <raph (at] n3rd [dot) org> (http://www.n3rd.org/)
	 who warned me about a bug in 0.5, I discovered that the last update was
	 a regress. I appologize for that.

	2010.05.09 - 0.5:
	 - bug fix: 0 is now preceeded with a + sign
	 - bug fix: the sign was not at the right position on padded results (Kamal Abdali)
	 - switched from GPL to BSD license

	2007.10.21 - 0.4:
	 - unit test and patch (David Baird)

	2007.09.17 - 0.3:
	 - bug fix: no longer throws exception on empty paramenters (Hans Pufal)

	2007.09.11 - 0.2:
	 - feature: added argument swapping

	2007.04.03 - 0.1:
	 - initial release
	**/

	var sprintf = (function() {
		function get_type(variable) {
			return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
		}
		function str_repeat(input, multiplier) {
			for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
			return output.join('');
		}

		var str_format = function() {
			if (!str_format.cache.hasOwnProperty(arguments[0])) {
				str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
			}
			return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
		};

		// convert object to simple one line string without indentation or
		// newlines. Note that this implementation does not print array
		// values to their actual place for sparse arrays. 
		//
		// For example sparse array like this
		//    l = []
		//    l[4] = 1
		// Would be printed as "[1]" instead of "[, , , , 1]"
		// 
		// If argument 'seen' is not null and array the function will check for 
		// circular object references from argument.
		str_format.object_stringify = function(obj, depth, maxdepth, seen) {
			var str = '';
			if (obj != null) {
				switch( typeof(obj) ) {
				case 'function': 
					return '[Function' + (obj.name ? ': '+obj.name : '') + ']';
				    break;
				case 'object':
					if ( obj instanceof Error) { return '[' + obj.toString() + ']' };
					if (depth >= maxdepth) return '[Object]'
					if (seen) {
						// add object to seen list
						seen = seen.slice(0)
						seen.push(obj);
					}
					if (obj.length != null) { //array
						str += '[';
						var arr = []
						for (var i in obj) {
							if (seen && seen.indexOf(obj[i]) >= 0) arr.push('[Circular]');
							else arr.push(str_format.object_stringify(obj[i], depth+1, maxdepth, seen));
						}
						str += arr.join(', ') + ']';
					} else if ('getMonth' in obj) { // date
						return 'Date(' + obj + ')';
					} else { // object
						str += '{';
						var arr = []
						for (var k in obj) { 
							if(obj.hasOwnProperty(k)) {
								if (seen && seen.indexOf(obj[k]) >= 0) arr.push(k + ': [Circular]');
								else arr.push(k +': ' +str_format.object_stringify(obj[k], depth+1, maxdepth, seen)); 
							}
						}
						str += arr.join(', ') + '}';
					}
					return str;
					break;
				case 'string':				
					return '"' + obj + '"';
					break
				}
			}
			return '' + obj;
		}

		str_format.format = function(parse_tree, argv) {
			var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
			for (i = 0; i < tree_length; i++) {
				node_type = get_type(parse_tree[i]);
				if (node_type === 'string') {
					output.push(parse_tree[i]);
				}
				else if (node_type === 'array') {
					match = parse_tree[i]; // convenience purposes only
					if (match[2]) { // keyword argument
						arg = argv[cursor];
						for (k = 0; k < match[2].length; k++) {
							if (!arg.hasOwnProperty(match[2][k])) {
								throw new Error(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
							}
							arg = arg[match[2][k]];
						}
					}
					else if (match[1]) { // positional argument (explicit)
						arg = argv[match[1]];
					}
					else { // positional argument (implicit)
						arg = argv[cursor++];
					}

					if (/[^sO]/.test(match[8]) && (get_type(arg) != 'number')) {
						throw new Error(sprintf('[sprintf] expecting number but found %s "' + arg + '"', get_type(arg)));
					}
					switch (match[8]) {
						case 'b': arg = arg.toString(2); break;
						case 'c': arg = String.fromCharCode(arg); break;
						case 'd': arg = parseInt(arg, 10); break;
						case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
						case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
					    case 'O': arg = str_format.object_stringify(arg, 0, parseInt(match[7]) || 5); break;
						case 'o': arg = arg.toString(8); break;
						case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
						case 'u': arg = Math.abs(arg); break;
						case 'x': arg = arg.toString(16); break;
						case 'X': arg = arg.toString(16).toUpperCase(); break;
					}
					arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
					pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
					pad_length = match[6] - String(arg).length;
					pad = match[6] ? str_repeat(pad_character, pad_length) : '';
					output.push(match[5] ? arg + pad : pad + arg);
				}
			}
			return output.join('');
		};

		str_format.cache = {};

		str_format.parse = function(fmt) {
			var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
			while (_fmt) {
				if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
					parse_tree.push(match[0]);
				}
				else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
					parse_tree.push('%');
				}
				else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosOuxX])/.exec(_fmt)) !== null) {
					if (match[2]) {
						arg_names |= 1;
						var field_list = [], replacement_field = match[2], field_match = [];
						if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
							field_list.push(field_match[1]);
							while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
								if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
									field_list.push(field_match[1]);
								}
								else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
									field_list.push(field_match[1]);
								}
								else {
									throw new Error('[sprintf] ' + replacement_field);
								}
							}
						}
						else {
	                        throw new Error('[sprintf] ' + replacement_field);
						}
						match[2] = field_list;
					}
					else {
						arg_names |= 2;
					}
					if (arg_names === 3) {
						throw new Error('[sprintf] mixing positional and named placeholders is not (yet) supported');
					}
					parse_tree.push(match);
				}
				else {
					throw new Error('[sprintf] ' + _fmt);
				}
				_fmt = _fmt.substring(match[0].length);
			}
			return parse_tree;
		};

		return str_format;
	})();

	var vsprintf = function(fmt, argv) {
		var argvClone = argv.slice();
		argvClone.unshift(fmt);
		return sprintf.apply(null, argvClone);
	};

	module.exports = sprintf;
	sprintf.sprintf = sprintf;
	sprintf.vsprintf = vsprintf;


/***/ }),
/* 131 */
/***/ (function(module, exports) {

	'use strict';

	var alphabet = { "M":13,"Z":26,"U":21,"F":6,"R":18,"T":20,"G":7,"S":19,"J":10,"D":4,"C":3,"X":24,"K":11,"Y":25,"E":5,"L":12,"Q":17,"B":2,"H":8,"P":16,"I":9,"N":14,"V":22,"W":23,"A":1,"O":15 };

	function XJSAddressParser(args) {
	    this.ranges_names = {};
	    for ( var rangeName in args.ranges_names ) {
	        var cleanRangeName = rangeName.replace(/\'/g, ''); // quickfix
	        this.ranges_names[cleanRangeName] = args.ranges_names[rangeName];
	    }

	    this.sheets_names = args.sheets_names;
	}

	XJSAddressParser.prototype = {
	    parse: function(excelAddr, sheetName) {
	        excelAddr = this._normalizeExcelAddress(excelAddr, sheetName);
	        return this._dereferenceExcelAddress(excelAddr);
	    },
	    sheetNameToNumber: function(sheetName) {
	        return this.sheets_names[sheetName]; // Quick fix
	    },
	    _normalizeExcelAddress: function(excelAddr, sheetName) {
	        var self = this;

	        var resolvedExcelAddress = self._findAddressByRangeName(excelAddr, sheetName);
	        if ( resolvedExcelAddress ) {
	            excelAddr = resolvedExcelAddress;
	        } else {
	            var rangeName = excelAddr.replace(/.*!/, '');
	            if ( self.ranges_names[rangeName] ) excelAddr = self.ranges_names[rangeName];
	        }

	        excelAddr = excelAddr.replace(/\$/g, '');

	        if ( !excelAddr.match(/!/) ) {
	            if (!sheetName) throw 'Sheet name required to normalize addr[' + excelAddr + ']';
	            excelAddr = sheetName + '!' + excelAddr;
	        }

	        return excelAddr.replace(/^=/, '');
	    },
	    _findAddressByRangeName: function(rangeName, sheetName) {
	        rangeName = rangeName.replace(/\'/g, '');

	        if ( this.ranges_names[rangeName] ) {
	            return this.ranges_names[rangeName];
	        }

	        if ( !rangeName.match(/!/) ) {
	            rangeName = sheetName + '!' + rangeName;

	            if ( this.ranges_names[rangeName] ) {
	                return this.ranges_names[rangeName];
	            }
	        }
	    },
	    _dereferenceExcelAddress: function(excelAddr) {
	        var self = this;
	        var match = excelAddr.match(/^'?(.+?)'?!([^!]+)$/);

	        if (match) {
	            var sheetName = match[1];
	            var sheetNum = self.sheets_names[sheetName];

	            if ( sheetNum === void 0 )  throw "There is no such sheet [" + sheetName + "]";

	            var shortAddresses = match[2].split(':');

	            if ( shortAddresses.length == 1 ) {
	                var addr = self._dereferenceExcelShortAddress( shortAddresses[0] );
	                return {
	                    type: 'cell',
	                    sheet: sheetNum,
	                    row: addr.row,
	                    col: addr.col
	                };
	            }
	            else if ( shortAddresses.length == 2 ) {
	                var startAddr = self._dereferenceExcelShortAddress( shortAddresses[0] );
	                var endAddr   = self._dereferenceExcelShortAddress( shortAddresses[1] );

	                if (startAddr.row === endAddr.row && startAddr.col === endAddr.col) {
	                    return {
	                        type: 'cell',
	                        sheet: sheetNum,
	                        row: startAddr.row,
	                        col: startAddr.col
	                    };
	                }

	                return {
	                    type: 'range',
	                    sheet: sheetNum,
	                    startRow: startAddr.row,
	                    startCol: startAddr.col,
	                    endRow: endAddr.row,
	                    endCol: endAddr.col
	                };
	            }
	        }

	        throw "Wrong address [" + excelAddr + "]";

	    },
	    _dereferenceExcelShortAddress: function(excelAddr) {
	        var match = excelAddr.match(/([A-Z]+)(\d+)/);

	        if (match) {
	            return {
	                col: this._charToNum(match[1]),
	                row: match[2] - 1
	            };
	        } else {
	            throw "Wrong address [" + excelAddr + "]";
	        }
	    },

	    _charToNum: function(chars){
	        var num = 0;
	        for( var i = 0; i < chars.length; i++){
	            num += Math.pow( 26, (chars.length-1) - i ) * alphabet[chars[i]];
	        }
	        return num - 1;
	    }
	};

	module.exports = XJSAddressParser;

/***/ }),
/* 132 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var XJSFormulaEvaluator = __webpack_require__(133);
	var functions  = __webpack_require__(135);

	module.exports.create = function() {
	    return new XJSFormulaEvaluator({ functions: functions });
	};

/***/ }),
/* 133 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var bench = {}
	global.bench = bench;

	var XJSRangeBase = __webpack_require__(129);
	var ModelRange = __webpack_require__(134);

	if ( true) {
	    var clc = __webpack_require__(7)
	    var BackAddressConvertor = __webpack_require__(5);
	    var BackFormulaConvertor = __webpack_require__(6);
	}

	module.exports = XJSFormulaEvaluator;

	var REF    = 0;
	var RANGE  = 1;
	var OFFSET = 2;

	function XJSFormulaEvaluator(args) {

	    if (!args) throw "Parameters required";
	    if (!args.functions) throw "Functions required";
	    this.functions = args.functions;
	}

	XJSFormulaEvaluator.prototype = {
	    evaluate: function(value, model, isDebug, parentOperation, storageForResultFlags) {
	        if ( true) {
	            if ( !this.backAddressConvertor ) {
	                this.backAddressConvertor = new BackAddressConvertor({sheetsNames: model.sheets_names});
	                this.backFormulaConvertor = new BackFormulaConvertor({backAddressConvertor: this.backAddressConvertor});
	            }
	        }

	        if ( ! Array.isArray(value) )  {
	            return value;
	        }

	        var operation = value[0];
	        if (typeof(operation) === 'object') throw 'WRONG OPERATION TYPE ' + parentOperation;
	        var func = this.functions[operation];
	        if (!func) console.log("FUNCTION ERROR!", operation, value, parentOperation)
	        func = func.bind(this);
	        // console.log('OP [%s]', operation );
	        // console.log(operation); logging

	        var computedArgs = [];
	        var resultFlags = {};

	        for ( var i = 1; i < value.length; i++ ) { // we strart from "1" because "0" is function name

	            // quick fix for skipping evalution of first argument cell reference passed to OFFSET
	            if (operation === OFFSET && i === 1 && value[i][0] ===  REF) {
	                computedArgs[i-1] = value[i];
	                continue;
	            }

	            if (Array.isArray(value[i])) {
	                computedArgs[i-1] = this.evaluate(value[i], model, isDebug, operation, resultFlags);
	            } else {
	                computedArgs[i-1] = value[i];
	            }

	        }

	        var res;

	        if ( true) {
	            if (isDebug) {
	                var astWithComputedArgs = [operation];
	                astWithComputedArgs.push.apply(astWithComputedArgs, computedArgs);
	                
	                res = func(computedArgs, model);
	                var originalFormula = this.backFormulaConvertor.convert(value);
	                var formulaWithComputedArgs = this.backFormulaConvertor.convert(astWithComputedArgs);

	                var dumpedRange;
	                if ( res instanceof XJSRangeBase ) {
	                    dumpedRange = res.dump();
	                }

	                if ( formulaWithComputedArgs === originalFormula ) {
	                    console.log( '    %s' + clc.whiteBright(' = %s'), formulaWithComputedArgs, dumpedRange||res );
	                } else {
	                    console.log(
	                        '    %s' + clc.whiteBright(' = ') + '%s' + clc.whiteBright(' = %s'),
	                        originalFormula, formulaWithComputedArgs, dumpedRange || res
	                    );
	                }

	            } else {
	                try { // TODO Remove try catch to gain a little bit faster execution
	                    res = func(computedArgs, model, parentOperation, isDebug);
	                } catch(e) {
	                    var astWithComputedArgs = [operation];
	                    astWithComputedArgs.push.apply(astWithComputedArgs, computedArgs);

	                    console.log(
	                        clc.redBright('\nFAILED WITH EXCEPTION IN: %s'),
	                        this.backFormulaConvertor.convert(astWithComputedArgs)
	                    );

	                    throw e;
	                }
	            }
	        }



	        if (false) {
	            res = func(computedArgs, model, parentOperation, isDebug);
	        }
	 
	        // if (!global.bench[operation]) {
	        //     global.bench[operation] = [0, 0]
	        // }

	        // // global.bench[operation][0] += end - start;
	        // // global.bench[operation][1]++

	        if ( operation === RANGE && resultFlags.isRecalculateEachCellInRange ) {
	            this.recalculateEachCellInRange(res);
	        }

	        if ( operation === OFFSET && this.runner) {
	            if (res[0] === REF) {
	                var intermediateResult = this.runner._getCellValue(res[1], res[2], res[3]); // Quick fix -> call runner recursively

	                if ( parentOperation === RANGE ) {
	                    storageForResultFlags.isRecalculateEachCellInRange = true;
	                    return res;
	                } else {
	                    return intermediateResult;
	                }
	            } else if (res instanceof ModelRange ) {
	                return res;
	            } 
	        }

	        return res;
	    },

	    recalculateEachCellInRange: function(range) {
	        for (var colNum = 0; colNum < range.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                var addr = range.getRangeValueInternalAddress(colNum, rowNum);
	                if (addr) {
	                    this.runner._getCellValue(addr[0], addr[1], addr[2]); // Quick fix -> call runner recursively
	                }
	            }
	        }
	    }
	};



/***/ }),
/* 134 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var XJSC = __webpack_require__(2);

	var util = __webpack_require__(3);
	var XJSRangeBase = __webpack_require__(129);

	function XJSRangeModel(args, model, evalator, isOffset) {
	    var sheetNum, startCol, startRow, endCol, endRow;

	    var addr2FirstArg;
	    if ( Array.isArray(args[1]) ) {
	        // First argument is range
	        sheetNum      = args[1][1];
	        startCol      = args[1][2];
	        startRow      = args[1][3];
	        addr2FirstArg = 2;
	    }  else {
	        sheetNum  = args[0];
	        startCol  = args[1];
	        startRow  = args[2];
	        addr2FirstArg = 3;
	    }

	    if ( Array.isArray(args[addr2FirstArg]) ) {
	        // second argument is range
	        endCol  = args[addr2FirstArg][2];
	        endRow  = args[addr2FirstArg][3];
	    } else {
	        endCol  = args[addr2FirstArg];
	        endRow  = args[addr2FirstArg+1];
	    }

	    if ( endCol < startCol ) { // switch variables
	        var newStartCol = endCol;
	        endCol = startCol;
	        startCol = newStartCol;
	    }

	    if ( endRow < startRow ) { // switch variables
	        var newStartRow = endRow;
	        endRow = startRow;
	        startRow = newStartRow;
	    }

	    this.colCount = endCol-startCol + 1;
	    this.rowCount = endRow-startRow + 1;

	    this._model    = model;
	    this._sheet    = model.sheets[sheetNum];
	    this._sheetNum = sheetNum;
	    this._startCol = startCol;
	    this._startRow = startRow;
	    this._end_col  = endCol;
	    this._end_row  = endRow;
	    this._evalator = evalator;
	    this._isOffset = isOffset;
	}

	util.inherits(XJSRangeModel, XJSRangeBase);

	XJSRangeModel.prototype.getRangeValue = function (rangeColNum, rangeRowNum) {
	    var sheet     = this._sheet;
	    var model     = this._model;
	    var sheetNum  = this._sheetNum;
	    var modelColNum = rangeColNum + this._startCol;
	    var modelRowNum = rangeRowNum + this._startRow;

	    if ( sheet[modelColNum] && sheet[modelColNum][modelRowNum] ) {
	        var cell = sheet[modelColNum][modelRowNum];


	        // var val = cellFromQueue[XJSC.CELL_VALUE];
	        // var calcedVal = this.formulaEvaluator.evaluate(val, model);


	        if ( !Array.isArray(cell) ) {
	            return cell;
	        } else if ( Array.isArray( cell[XJSC.CELL_VALUE] ) )  {       
	            if (this._isOffset) {
	                return global.xjs._getCellValue(sheetNum, modelColNum, modelRowNum);
	            }

	            var cachedVal = cell[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE];

	            if (cachedVal === void 0) {
	                throw "NO CACHED VAL";
	            }
	            return cachedVal;
	        } else {            
	            return cell[XJSC.CELL_VALUE];
	        }
	    } else {
	        return '';
	    }
	};

	XJSRangeModel.prototype.getRangeValueInternalAddress =function(rangeColNum, rangeRowNum) {
	    var modelColNum = rangeColNum + this._startCol;
	    var modelRowNum = rangeRowNum + this._startRow;
	    return [this._sheetNum, modelColNum, modelRowNum];
	};


	module.exports = XJSRangeModel;

/***/ }),
/* 135 */
/***/ (function(module, exports, __webpack_require__) {

	// Autogenerated file.
	// Use "bin/generate_functions_mappings" script to update this file.
	var functions=[];
	functions[0]=__webpack_require__(136);
	functions[1]=__webpack_require__(137);
	functions[2]=__webpack_require__(138);
	functions[3]=__webpack_require__(139);
	functions[4]=__webpack_require__(141);
	functions[5]=__webpack_require__(142);
	functions[6]=__webpack_require__(143);
	functions[7]=__webpack_require__(144);
	functions[8]=__webpack_require__(145);
	functions[9]=__webpack_require__(146);
	functions[10]=__webpack_require__(147);
	functions[11]=__webpack_require__(148);
	functions[12]=__webpack_require__(149);
	functions[13]=__webpack_require__(150);
	functions[14]=__webpack_require__(151);
	functions[15]=__webpack_require__(152);
	functions[16]=__webpack_require__(153);
	functions[17]=__webpack_require__(154);
	functions[18]=__webpack_require__(155);
	functions[19]=__webpack_require__(156);
	functions[20]=__webpack_require__(157);
	functions[21]=__webpack_require__(158);
	functions[22]=__webpack_require__(159);
	functions[23]=__webpack_require__(160);
	functions[24]=__webpack_require__(161);
	functions[25]=__webpack_require__(162);
	functions[26]=__webpack_require__(163);
	functions[27]=__webpack_require__(164);
	functions[28]=__webpack_require__(165);
	functions[29]=__webpack_require__(166);
	functions[30]=__webpack_require__(167);
	functions[31]=__webpack_require__(168);
	functions[32]=__webpack_require__(169);
	functions[33]=__webpack_require__(170);
	functions[34]=__webpack_require__(171);
	functions[35]=__webpack_require__(172);
	functions[36]=__webpack_require__(173);
	functions[37]=__webpack_require__(174);
	functions[38]=__webpack_require__(175);
	functions[39]=__webpack_require__(176);
	functions[40]=__webpack_require__(178);
	functions[41]=__webpack_require__(179);
	functions[42]=__webpack_require__(179);
	functions[43]=__webpack_require__(180);
	functions[44]=__webpack_require__(181);
	functions[45]=__webpack_require__(182);
	functions[46]=__webpack_require__(183);
	functions[47]=__webpack_require__(184);
	functions[48]=__webpack_require__(184);
	functions[49]=__webpack_require__(185);
	functions[50]=__webpack_require__(186);
	functions[51]=__webpack_require__(187);
	functions[52]=__webpack_require__(188);
	functions[53]=__webpack_require__(189);
	functions[54]=__webpack_require__(190);
	functions[55]=__webpack_require__(191);
	functions[56]=__webpack_require__(192);
	functions[57]=__webpack_require__(193);
	functions[58]=__webpack_require__(194);
	functions[59]=__webpack_require__(195);
	functions[60]=__webpack_require__(196);
	functions[61]=__webpack_require__(197);
	functions[62]=__webpack_require__(198);
	functions[63]=__webpack_require__(199);
	functions[64]=__webpack_require__(200);
	functions[65]=__webpack_require__(201);
	functions[66]=__webpack_require__(202);
	functions[67]=__webpack_require__(203);
	functions[68]=__webpack_require__(204);
	functions[69]=__webpack_require__(205);
	functions[73]=__webpack_require__(178);
	functions[70]=__webpack_require__(206);
	functions[72]=__webpack_require__(207);
	functions[71]=__webpack_require__(208);
	module.exports = functions;


/***/ }),
/* 136 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	var XJSC     = __webpack_require__(2);


	// CAUTION THIS IS LOW LEVEL FUNCTION. It works directly with model and provides address ranges support


	if ( true) {
	    var BackAddressConvertor = __webpack_require__(5);
	    var backAddressConvertor;
	}

	module.exports = function(args, model, parentOperation, isDebug) {
	    // TODO add debug mode!!!

	    if ( true) {
	        if ( !backAddressConvertor ) {
	            backAddressConvertor = new BackAddressConvertor({sheetsNames: model.sheets_names});
	        }
	    }

	    var sheetNum = args[0];
	    var colNum   = args[1];
	    var rowNum   = args[2];

	    if ( !model.sheets[ sheetNum ][ colNum ] ) {
	        return '';
	    }

	    var resolvedCell = model.sheets[sheetNum][colNum][rowNum];
	    if ( resolvedCell === void 0 ) {
	        return '';
	    }

	    var value = args;

	    if ( !resolvedCell && resolvedCell !== 0 ) {
	        if ( (true) && isDebug) {
	            console.log('NOT_RESOLVED', resolvedCell, value);
	        }
	        return 0;
	    }

	    if ( typeof(resolvedCell) !== 'object' ) {
	        return resolvedCell || 0;
	    }

	    if ( typeof( resolvedCell[XJSC.CELL_VALUE] ) === 'object' )  {
	        var cachedVal;
	        var cacheVersion = resolvedCell[XJSC.CELL_METADATA][XJSC.MD_CACHE_VERSION];

	        if (cacheVersion === model.cacheVersion) {
	            cachedVal = resolvedCell[XJSC.CELL_METADATA][XJSC.MD_CACHED_VALUE];
	        }

	        if ( cachedVal === void 0 ) {
	            throw "NO CACHED VAL";
	        }

	        if ( (true) && isDebug) {
	            console.log('CACHED_VAL',
	                cachedVal,
	                value,
	                backAddressConvertor.convert({
	                    sheetNum: sheetNum,
	                    colNum: colNum,
	                    rowNum: rowNum
	                })
	            );
	        }

	        return cachedVal;
	    } else {
	         if ( (true) && isDebug) {
	            console.log( 'STATIC_VAL',
	                resolvedCell[XJSC.CELL_VALUE],
	                value,
	                backAddressConvertor.convert({
	                    sheetNum: sheetNum,
	                    colNum: colNum,
	                    rowNum: rowNum
	                })
	            );
	        }

	        return resolvedCell[XJSC.CELL_VALUE];
	    }
	};


/***/ }),
/* 137 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var XJSRange = __webpack_require__(134);

	// CAUTION THIS IS LOW LEVEL FUNCTION. It works directly with model and provides address ranges support

	module.exports = function(args, model) {
	    return new XJSRange(args, model);
	};

/***/ }),
/* 138 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var XJSRange = __webpack_require__(134);

	var REF   = 0;
	var RANGE = 1;

	// CAUTION THIS IS LOW LEVEL FUNCTION. It works directly with model and provides address ranges support

	// reference indexes
	var SHEET     = 1;
	var START_COL = 2;
	var START_ROW = 3;
	var END_COL   = 4;
	var END_ROW   = 5;

	module.exports = function(args, model, parentOperation) {
	    var reference =  args[0];
	    var rows      = +(+args[1]).toFixed(0);
	    var cols      = +args[2];
	    var height    = args[3] ? Math.floor(+args[3]) : false;
	    var width     = args[4] ? Math.floor(+args[4]) : false;
	    var operator  = reference[0];
	    
	    if ( isNaN(rows) || isNaN(cols) || isNaN(height) || isNaN(width) ){
	        return '#VALUE!';
	    }

	    if ( operator === REF ) {
	        if (!height) height = 1;
	        if (!width) width = 1;
	    } else if (operator === RANGE) {
	        if (!height) height = reference[END_ROW]-reference[START_ROW] + 1;
	        if (!width) width = reference[END_COL]-reference[START_COL] + 1;
	    }

	    var sheetNum = reference[SHEET];
	    var startCol = reference[START_COL]+cols;
	    var startRow = reference[START_ROW]+rows;

	    if ( height == 1 && width == 1 ) {
	        // if ( reference[SHEET] ==  12 && reference[START_COL] == 30 && reference[START_ROW] == 28 ) {
	            // console.log('OFFSET_ARGS', args);
	        // }

	        return [REF, sheetNum, startCol, startRow];
	    } else {
	        width = width > 0 ? width-1 : width+1;
	        height = height > 0 ? height-1 : height+1;
	        var range = new XJSRange([sheetNum, startCol, startRow, startCol+width, startRow+height], model, this, true);
	        // this.recalculateEachCellInRange(range);
	        return range;//TODO IS IT OK?
	        //return ['RANGE', sheetNum, startCol, startRow, startCol+width-1, startRow+height-1];
	    }
	};

/***/ }),
/* 139 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var Range = __webpack_require__(140);

	module.exports = function(args) {
	    if ( typeof(args[0]) === 'object' && typeof(args[1]) === 'object' ) {
	        var range1 = args[0];
	        var range2 = args[1];

	        if (range1.colCount != range2.colCount) return '#N/A';
	        if (range1.rowCount != range2.rowCount) return '#N/A';

	        var res = [];

	        for (var colNum = 0; colNum < range1.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range1.rowCount; rowNum++) {
	                var value1 = range1.getRangeValue(colNum, rowNum);
	                var value2 = range2.getRangeValue(colNum, rowNum);
	                value1 = value1 ? +value1 : 0;
	                value2 = value2 ? +value2 : 0;
	                if ( isNaN(value1) || isNaN(value2) ){
	                    res.push( "#VALUE!" );
	                } else {
	                    res.push( value1 + value2 );
	                }
	            }
	        }

	        return new Range(res);
	    } else if ( !isNaN(+args[0]) && !isNaN(+args[1])) {
	        var value1 = args[0] ? +args[0] : 0;
	        var value2 = args[1] ? +args[1] : 0;
	        if ( isNaN(value1) || isNaN(value2) ){
	            return "#VALUE!";
	        }
	        return value1 + value2;
	    } else if ( typeof(args[0]) === 'object' && !isNaN(+args[1])  ){

	        var range1 = args[0];
	        var value2 = +args[1];
	        var res = [];

	        for (var colNum = 0; colNum < range1.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range1.rowCount; rowNum++) {
	                var value1 = range1.getRangeValue(colNum, rowNum);
	                value1 = value1 ? +value1 : 0;
	                value2 = value2 ? +value2 : 0;
	                if ( isNaN(value1) || isNaN(value2) ){
	                    res.push( "#VALUE!" );
	                } else {
	                    res.push( value1 + value2 );
	                }
	            }
	        }
	        var resRange = new Range(res);
	        resRange.rowCount = range1.rowCount;
	        resRange.colCount = range1.colCount;

	        return resRange;

	    } else {
	        if ( isNaN(+args[0]) || isNaN(+args[1])) return '#VALUE!';
	    }
	};

/***/ }),
/* 140 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';

	var util = __webpack_require__(3);
	var XJSRangeBase = __webpack_require__(129);

	function XJSRangeArray(rangeArray, colCount, rowCount) {
	    if (!colCount && !rowCount) {
	        colCount = rangeArray.length;
	        rowCount = 1;
	    }

	    this.rangeArray = rangeArray;
	    this.colCount   = colCount;
	    this.rowCount   = rowCount;
	}

	util.inherits(XJSRangeArray, XJSRangeBase);

	XJSRangeArray.prototype.getRangeValue = function (rangeColNum, rangeRowNum) {
	    var num = rangeRowNum * this.colCount + rangeColNum;

	    return this.rangeArray[num];
	};


	module.exports = XJSRangeArray;

/***/ }),
/* 141 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var value1 = +args[0];
	    var value2 = +args[1];

	    if ( isNaN(value1) || isNaN(value2) ) return '#VALUE!';

	    return value1 - value2 ;

	};

/***/ }),
/* 142 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";
	var Range = __webpack_require__(140);

	module.exports = function(args) {
	    if ( typeof(args[0]) === 'object' && typeof(args[1]) === 'object' ) {
	        var range1 = args[0];
	        var range2 = args[1];

	        var res = [];

	        for (var colNum = 0; colNum < range1.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range1.rowCount; rowNum++) {
	                var value1 = range1.getRangeValue(colNum, rowNum);
	                var value2 = range2.getRangeValue(colNum, rowNum);
	                value1 = value1 ? value1: 0;
	                value2 = value2 ? value2: 0;

	                if ( isNaN(value1 * value2) ){
	                    res.push( "#VALUE!" );
	                }else{
	                    res.push( value1 * value2 );
	                }
	            }
	        }

	        return new Range(res);
	    } else if ( !Array.isArray(args[0]) && !Array.isArray(args[1])) {

	        var value1 = args[0] ? args[0]: 0;
	        var value2 = args[1] ? args[1]: 0;

	        if ( isNaN(value1 * value2) ){
	            return "#VALUE!" ;
	        } else {
	            return args[0] * args[1];
	        }

	    } else {
	        throw "NOT SUPPORTED MODE IN [Multiply]"
	    }
	};

/***/ }),
/* 143 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    if ( !args[1] ){
	        return '#DIV/0!';
	    }
	    var result = args[0] / args[1];
	    return isNaN(result) ? '#VALUE!' : result;

	};


/***/ }),
/* 144 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if ( isNaN(+args[0]) || isNaN(+args[1]) ) return "#VALUE!";
	    if ( +args[0] === 0 && +args[1] === 0 ) return "#NUM!";

	    return Math.pow(args[0], args[1]);
	};

/***/ }),
/* 145 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if (args[0] === '' && (!args[1].match || args[1].match(/^\d+$/) ) ) return 1;

	    // This version of the engine does not support string comparison
	    return parseFloat(args[0]||0) > parseFloat(args[1]||0) ? 1 : 0;
	};

/***/ }),
/* 146 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    // This version of the engine does not support string comparison
	    
	    return parseFloat(args[0]||0) < parseFloat(args[1]||0) ? 1 : 0;
	};

/***/ }),
/* 147 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    // This version of the engine does not support string comparison
	    return parseFloat(args[0]||0) >= parseFloat(args[1]||0) ? 1 : 0;
	};

/***/ }),
/* 148 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    // This version of the engine does not support string comparison
	    return parseFloat(args[0]||0) <= parseFloat(args[1]||0) ? 1 : 0;
	};

/***/ }),
/* 149 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    return args[0] != args[1] ? 1 : 0;
	};

/***/ }),
/* 150 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var res = 0;
	    var condition = args[0];
	    if ( typeof +condition !== "number" && typeof condition !== "boolean" ) return "#VALUE!" ;

	    if (args.length == 1) {
	        res = args[0] ? 1 : 0;
	    }
	    else if (args.length == 2) {
	        res = args[0] ? args[1] : 0;
	    }
	    else if (args.length == 3) {
	        res = args[0] ? args[1] : args[2];
	    }
	    else{
	        throw "IF: condition required";
	    }
	    return res;
	};


/***/ }),
/* 151 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var sum = 0;
	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) === 'object' ) {
	            // Process range
	            var range = args[i];

	             for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var value = +range.getRangeValue(colNum, rowNum);
	                    if ( !isNaN(value) ){
	                        sum += value;
	                    }
	                }
	            }
	        }
	        else {
	            if ( isNaN(+args[i]) ) return '#VALUE!';
	            sum += +args[i]
	        }
	    }
	    return +sum;
	};

/***/ }),
/* 152 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var position = parseInt(args[0], 10);
	    return args[position];
	};

/***/ }),
/* 153 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var result = '#VALUE?';
	    main:
	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) === 'object' ) {
	            var range = args[i];
	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var value = range.getRangeValue(colNum, rowNum);
	                    if ( typeof value == 'number' || typeof value == 'boolean' ){
	                        if ( value == 0) {
	                            result = 0;
	                            break main;
	                        } else {
	                            result = 1;
	                        }
	                    }
	                }
	            }
	        } else {
	            if ( typeof args[i] == 'number' || typeof args[i] == 'boolean' ){
	                if ( args[i] == 0) {
	                    result = 0;
	                    break main;
	                } else {
	                    result = 1;
	                }
	            }
	        }
	    }

	    return result;
	};


/***/ }),
/* 154 */
/***/ (function(module, exports) {

	"use strict";
	module.exports = function(args) {
	    var a = formatArgument(args[0]);
	    var b = formatArgument(args[1]);
	    return a === b;
	};

	function formatArgument(arg){
	    var result = typeof arg === 'boolean' || isNaN(arg) ? arg: +arg;
	    return typeof result === 'string' ? result.toLowerCase() : result;
	};


/***/ }),
/* 155 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var rate = parseFloat( args[0] );
	    var nper = +args[1];
	    var pmt  = +args[2];
	    var fv   = parseFloat( args[3] || 0 );
	    var type = parseInt( args[4] || 0 );

	    if ( isNaN(rate) || isNaN(nper) || isNaN(pmt) ) return '#VALUE!';

	    if ( rate == 0 ) {
	        return -( (pmt*nper)+fv );
	    }

	    var accum_rate = Math.pow(rate+1, nper);

	    if (pmt) {
	        var annuity_fv = pmt*((accum_rate-1)/rate);
	        if (type == 1) annuity_fv *= (1+rate);

	        fv += annuity_fv;
	    }

	    var accum_rate = Math.pow(rate+1, nper);
	    return -( fv/accum_rate );
	}

/***/ }),
/* 156 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (args) {
	    var searchValue = args[0];
	    var range       = args[1];
	    var indexNumber = +args[2];
	    var isNotExact  = args[3] === undefined || args[3] === null  ? 1 : +args[3];

	    if ( isNaN(indexNumber) || indexNumber <= 0) {
	        return '#VALUE!';
	    }

	    if ( typeof +isNotExact !== 'number' && typeof isNotExact !== 'boolean'){
	        return '#VALUE!';
	    }

	    if ( indexNumber > range.colCount) return '#REF!';

	    var matchedRowNum;
	    for ( var i=0; i<range.rowCount; i++ ) {
	        var val = range.getRangeValue(0, i);

	        if ( isEqualIgnoreCaseString(val, searchValue) || val == searchValue ) {
	            matchedRowNum = i;
	            break;
	        } else if (isNotExact) {
	            if ( val < searchValue ) {
	                matchedRowNum = i;
	            } else if ( val > searchValue ) {
	                break;
	            }
	        }
	    }

	    if ( matchedRowNum  === undefined ) {
	        return '#N/A'
	    }

	    return range.getRangeValue(indexNumber-1, matchedRowNum);
	};

	function isEqualIgnoreCaseString(lhs, rhs) {
	    return typeof lhs === 'string'
	        && typeof rhs === 'string'
	        && lhs.toLowerCase() === rhs.toLowerCase();
	}


/***/ }),
/* 157 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var value = +args[0];
	    if ( isNaN(value) ) return '#VALUE!' ;
	    return Math.abs(args[0]);
	};

/***/ }),
/* 158 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var sum = 0;
	    var cnt = 0;

	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) === 'object' ) {
	            // Process range
	            var range = args[i];

	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var value = range.getRangeValue(colNum, rowNum);
	                    value = value === "" ? NaN : +value;
	                    if ( !isNaN(value) ){

	                        sum += value;
	                        cnt++;
	                    }
	                }
	            }
	        } else {
	            var value = +args[i];
	            if ( isNaN(value) ){
	                return '#VALUE!';
	            }
	            sum += value;
	            cnt++;
	        }
	    }
	    if (cnt === 0){
	        return '#DIV/0!';
	    }
	    return sum/cnt;
	};

/***/ }),
/* 159 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var string = '';

	    for (var i=0; i<args.length; i++ ) {
	        if ( args[i] !== null && args[i] !== undefined ) {
	            string += args[i];
	        }
	    }

	    return string;
	};

/***/ }),
/* 160 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var range    = args[0];
	    var criteria = args[1];

	    var testers = {
	        '>': function(a, b) { return a > b; },
	        '<': function(a, b) { return a < b; },
	        '<=': function(a, b) { return a <= b; },
	        '>=': function(a, b) { return a >= b; },
	        '=': function(a, b) { return a == b; }
	    };

	    var match = criteria.match('^(<=|>=|=|<|>)?(.+)');

	    if (match) {
	        var oper = match[1] || '=';
	        var base_value = match[2];
	        var cnt = 0;

	        for (var colNum = 0; colNum < range.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                if ( testers[oper]( +range.getRangeValue(colNum, rowNum), base_value ) ) {
	                    cnt++;
	                }
	            }
	        }

	        return cnt;
	    }

	    throw "Wrong criteria: " + criteria;
	};


/***/ }),
/* 161 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var range     = args[0];
	    var criteria  = args[1];
	    var sum_range = args[2] || range;

	    var testers = {
	        '>': function(a, b) { return a > b },
	        '<': function(a, b) { return a < b },
	        '<=': function(a, b) { return a <= b },
	        '>=': function(a, b) { return a >= b },
	        '=': function(a, b) { return a == b }
	    };

	    var match = criteria.match('^(<=|>=|=|<|>)(.+)');

	    if (match) {
	        var oper = match[1] || '=';
	        var base_value = match[2];
	        var sum = 0;

	        for (var colNum = 0; colNum < range.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {

	                var value = range.getRangeValue(colNum, rowNum);
	                if ( testers[oper](value ? value - 0: value, base_value) )  {
	                    sum += sum_range.getRangeValue(colNum, rowNum)-0 || 0;
	                }
	            }
	        }

	        return sum;
	    }

	    throw "Wrong criteria: " + criteria
	};

/***/ }),
/* 162 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var value = +args[0];
	    if ( isNaN(value) ) return '#VALUE!';
	    if ( value === 0 ) return '#NUM!';
	    return Math.log(args[0]);
	};

/***/ }),
/* 163 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var max = null;

	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) == 'object' ) {
	            var range = args[i];

	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var val = +range.getRangeValue(colNum, rowNum);
	                    if ( !isNaN(val) ){
	                        if (max === null) max = val;
	                        if (val > max) max = val;
	                    }
	                }
	            }
	        }
	        else {
	            var val = +args[i];

	            if ( !isNaN(val) ){
	                if (max === null) max = val;
	                if (val > max) max = val;
	            }
	        }
	    }

	    max = max ? max : 0;
	    return max;
	};

/***/ }),
/* 164 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var min = null;

	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) == 'object' ) {
	            var range = args[i];

	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var val = +range.getRangeValue(colNum, rowNum);
	                    if ( !isNaN(val) ){
	                        if (min === null) min = val;
	                        if (val < min) min = val;
	                    }
	                }
	            }
	        }
	        else {
	            var val = +args[i];

	            if ( !isNaN(val) ){
	                if (min === null) min = val;
	                if (val < min) min = val;
	            }
	        }
	    }

	    min = min ? min : 0;
	    return min;
	};

/***/ }),
/* 165 */
/***/ (function(module, exports) {

	//***********************
	//*NOT SUPPORT DATE TYPE*
	//***********************

	"use strict";

	module.exports = function(args) {

	    var errors = {
	        "#NULL!":  true,
	        "#N/A":    true,
	        "#VALUE!": true,
	        "#REF!":   true,
	        "#DIV/0!": true,
	        "#NUM!":   true,
	        "#NAME?":  true
	    };

	    if ( errors[args[0]] ) return args[0];
	    if ( typeof args[0] == 'boolean') return +args[0];
	    if ( typeof args[0] == 'number')  return  args[0];

	    return 0;
	};

/***/ }),
/* 166 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var result = '#VALUE?';
	    main:
	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) === 'object' ) {
	            var range = args[i];
	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var value = range.getRangeValue(colNum, rowNum);
	                    if ( typeof value == 'number' || typeof value == 'boolean' ){
	                        if ( value != 0 ) {
	                            result = 1;
	                            break main;
	                        } else {
	                            result = 0;
	                        }
	                    }
	                }
	            }
	        } else {
	            if ( typeof args[i] == 'number' || typeof args[i] == 'boolean' ){
	                if ( args[i] != 0 ) {
	                    result = 1;
	                    break main;
	                } else {
	                    result = 0;
	                }
	            }
	        }
	    }
	    return result;
	};

/***/ }),
/* 167 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function() {
	    return Math.random();
	};

/***/ }),
/* 168 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var number = args[0];
	    var digits = args[1];

	    if ( isNaN(number) || isNaN(digits) ) return "#VALUE!";

	    return Math.round(number * Math.pow(10, digits)) / Math.pow(10, digits);
	}

/***/ }),
/* 169 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var value = +args[0];

	    if ( isNaN(value) ) return '#VALUE!';
	    if ( value < 0 ) return '#NUM!';

	    return Math.sqrt(args[0]);
	};

/***/ }),
/* 170 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(ranges) {
	    var sumOfProduct = 0;

	    var colCount = ranges[0].colCount;
	    var rowCount = ranges[0].rowCount;

	    for (var colNum = 0; colNum < colCount; colNum++) {
	        for (var rowNum = 0; rowNum < rowCount; rowNum++) {
	            var product = ranges[0].getRangeValue(colNum, rowNum);
	            product = +product || 0;//in Excel string values ​​are replaced by 0!!!

	            for ( var range_idx=1; range_idx<ranges.length; range_idx++ ) {
	                if ( ranges[range_idx].colCount != colCount || ranges[range_idx].rowCount != rowCount) {
	                    return '#VALUE!'
	                }

	                var val = ranges[range_idx].getRangeValue(colNum, rowNum);
	                val = (val - 0) || 0; // make number

	                product *= val;
	                if (val == 0) break;
	            }

	            sumOfProduct += product
	        }
	    }

	    return sumOfProduct
	};

/***/ }),
/* 171 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if ( (args[0] + '') === args[0] ) {
	        return args[0]
	    } else {
	        return ""
	    }
	};

/***/ }),
/* 172 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if ( typeof(args[0]) == 'object' ) {
	        // Range processing
	        var range = args[0];
	        var cnt = 0;

	        for (var colNum = 0; colNum < range.colCount; colNum++) {
	            for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                var value = range.getRangeValue(colNum, rowNum);

	                if ( value === "" || value === undefined || value === null ) {
	                    cnt++;
	                }
	            }
	        }

	        return cnt;
	    } else {
	        // Single value
	        if ( value === "" || value === undefined || value === null ) {
	            return 1;
	        } else {
	            return 0;
	        }
	    }
	};

/***/ }),
/* 173 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    return Math.pow(2.71828182845904, args[0]);
	};

/***/ }),
/* 174 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var product = null;

	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) === 'object' ) {
	            // Process range
	            var range = args[i];

	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var val = parseFloat(range.getRangeValue(colNum, rowNum));
	                    if ( !isNaN(+val) && val != ''){
	                        if (product === null) product = val;
	                        product *= val;
	                    }
	                }
	            }
	        }
	        else {
	            if ( isNaN(+args[i]) ) return "#VALUE!";

	            if (product === null) product = +args[i];
	            product *= +args[i];

	        }
	    }

	    if ( product === null ) return 0;

	    return product;
	};

/***/ }),
/* 175 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var search_value = +args[0];
	    var lookup_range = args[1];
	    var result_range = args[2] || lookup_range;

	    if (typeof search_value !== 'number' ) {
	        return '#N/A';
	    }

	    if (lookup_range.colCount != result_range.colCount) {
	         return '#N/A';
	    }
	    if (lookup_range.rowCount != result_range.rowCount) {
	        return '#N/A';
	    }

	    var matched_row_num;
	    var matched_col_num;


	    for (var colNum = 0; colNum < lookup_range.colCount; colNum++) {
	        for (var rowNum = 0; rowNum < lookup_range.rowCount; rowNum++) {

	            var val = +lookup_range.getRangeValue(colNum, rowNum); // Force numeric context

	            if ( typeof val === 'number'){
	                if ( val == search_value ) {
	                    matched_row_num = rowNum;
	                    matched_col_num = colNum;
	                    break;
	                } else {
	                    if ( val < search_value ) {
	                        matched_row_num = rowNum;
	                        matched_col_num = colNum;
	                    } else if ( val > search_value ) {
	                        break;
	                    }
	                }
	            }
	        }
	    }


	    if ( matched_col_num  === undefined || matched_row_num  === undefined ) {
	        return '#N/A';
	    }

	    return result_range.getRangeValue(matched_col_num, matched_row_num);

	};


/***/ }),
/* 176 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var jStatModule = __webpack_require__(177).jStat;

	module.exports = function(args) {
	    var jStatLocal  = jStatModule || jStat;

	    var A = (args[3] === void 0) ? 0 : +args[3];
	    var B = (args[4] === void 0) ? 1 : +args[4];

	    var probability = +args[0];
	    var alpha       = +args[1];
	    var beta        = +args[2];

	    if ( isNaN(probability) || isNaN(alpha) || isNaN(beta) || isNaN(A) || isNaN(B) ){
	        return '#VALUE!';
	    }
	    if ( probability <= 0 || probability >= 1 ) return '#NUM!';
	    if ( alpha <= 0 || beta <= 0 ) return '#NUM!';
	    if ( A >= B ) return '#NUM!';

	    return jStatLocal.beta.inv(probability, alpha, beta) * (B - A) + A;
	}



/***/ }),
/* 177 */
/***/ (function(module, exports, __webpack_require__) {

	(function (window, factory) {
	    if (true) {
	        module.exports = factory();
	    } else if (typeof define === 'function' && define.amd) {
	        define(factory);
	    } else {
	        window.jStat = factory();
	    }
	})(this, function () {
	var jStat = (function(Math, undefined) {

	// For quick reference.
	var concat = Array.prototype.concat;
	var slice = Array.prototype.slice;
	var toString = Object.prototype.toString;

	// Calculate correction for IEEE error
	// TODO: This calculation can be improved.
	function calcRdx(n, m) {
	  var val = n > m ? n : m;
	  return Math.pow(10,
	                  17 - ~~(Math.log(((val > 0) ? val : -val)) * Math.LOG10E));
	}


	var isArray = Array.isArray || function isArray(arg) {
	  return toString.call(arg) === '[object Array]';
	};


	function isFunction(arg) {
	  return toString.call(arg) === '[object Function]';
	}


	function isNumber(arg) {
	  return typeof arg === 'number' && arg === arg;
	}


	// Converts the jStat matrix to vector.
	function toVector(arr) {
	  return concat.apply([], arr);
	}


	// The one and only jStat constructor.
	function jStat() {
	  return new jStat._init(arguments);
	}


	// TODO: Remove after all references in src files have been removed.
	jStat.fn = jStat.prototype;


	// By separating the initializer from the constructor it's easier to handle
	// always returning a new instance whether "new" was used or not.
	jStat._init = function _init(args) {
	  var i;

	  // If first argument is an array, must be vector or matrix.
	  if (isArray(args[0])) {
	    // Check if matrix.
	    if (isArray(args[0][0])) {
	      // See if a mapping function was also passed.
	      if (isFunction(args[1]))
	        args[0] = jStat.map(args[0], args[1]);
	      // Iterate over each is faster than this.push.apply(this, args[0].
	      for (var i = 0; i < args[0].length; i++)
	        this[i] = args[0][i];
	      this.length = args[0].length;

	    // Otherwise must be a vector.
	    } else {
	      this[0] = isFunction(args[1]) ? jStat.map(args[0], args[1]) : args[0];
	      this.length = 1;
	    }

	  // If first argument is number, assume creation of sequence.
	  } else if (isNumber(args[0])) {
	    this[0] = jStat.seq.apply(null, args);
	    this.length = 1;

	  // Handle case when jStat object is passed to jStat.
	  } else if (args[0] instanceof jStat) {
	    // Duplicate the object and pass it back.
	    return jStat(args[0].toArray());

	  // Unexpected argument value, return empty jStat object.
	  // TODO: This is strange behavior. Shouldn't this throw or some such to let
	  // the user know they had bad arguments?
	  } else {
	    this[0] = [];
	    this.length = 1;
	  }

	  return this;
	};
	jStat._init.prototype = jStat.prototype;
	jStat._init.constructor = jStat;


	// Utility functions.
	// TODO: for internal use only?
	jStat.utils = {
	  calcRdx: calcRdx,
	  isArray: isArray,
	  isFunction: isFunction,
	  isNumber: isNumber,
	  toVector: toVector
	};


	// Easily extend the jStat object.
	// TODO: is this seriously necessary?
	jStat.extend = function extend(obj) {
	  var i, j;

	  if (arguments.length === 1) {
	    for (j in obj)
	      jStat[j] = obj[j];
	    return this;
	  }

	  for (var i = 1; i < arguments.length; i++) {
	    for (j in arguments[i])
	      obj[j] = arguments[i][j];
	  }

	  return obj;
	};


	// Returns the number of rows in the matrix.
	jStat.rows = function rows(arr) {
	  return arr.length || 1;
	};


	// Returns the number of columns in the matrix.
	jStat.cols = function cols(arr) {
	  return arr[0].length || 1;
	};


	// Returns the dimensions of the object { rows: i, cols: j }
	jStat.dimensions = function dimensions(arr) {
	  return {
	    rows: jStat.rows(arr),
	    cols: jStat.cols(arr)
	  };
	};


	// Returns a specified row as a vector or return a sub matrix by pick some rows
	jStat.row = function row(arr, index) {
	  if (isArray(index)) {
	    return index.map(function(i) {
	      return jStat.row(arr, i);
	    })
	  }
	  return arr[index];
	};


	// return row as array
	// rowa([[1,2],[3,4]],0) -> [1,2]
	jStat.rowa = function rowa(arr, i) {
	  return jStat.row(arr, i);
	};


	// Returns the specified column as a vector or return a sub matrix by pick some
	// columns
	jStat.col = function col(arr, index) {
	  if (isArray(index)) {
	    var submat = jStat.arange(arr.length).map(function(i) {
	      return new Array(index.length);
	    });
	    index.forEach(function(ind, i){
	      jStat.arange(arr.length).forEach(function(j) {
	        submat[j][i] = arr[j][ind];
	      });
	    });
	    return submat;
	  }
	  var column = new Array(arr.length);
	  for (var i = 0; i < arr.length; i++)
	    column[i] = [arr[i][index]];
	  return column;
	};


	// return column as array
	// cola([[1,2],[3,4]],0) -> [1,3]
	jStat.cola = function cola(arr, i) {
	  return jStat.col(arr, i).map(function(a){ return a[0] });
	};


	// Returns the diagonal of the matrix
	jStat.diag = function diag(arr) {
	  var nrow = jStat.rows(arr);
	  var res = new Array(nrow);
	  for (var row = 0; row < nrow; row++)
	    res[row] = [arr[row][row]];
	  return res;
	};


	// Returns the anti-diagonal of the matrix
	jStat.antidiag = function antidiag(arr) {
	  var nrow = jStat.rows(arr) - 1;
	  var res = new Array(nrow);
	  for (var i = 0; nrow >= 0; nrow--, i++)
	    res[i] = [arr[i][nrow]];
	  return res;
	};

	// Transpose a matrix or array.
	jStat.transpose = function transpose(arr) {
	  var obj = [];
	  var objArr, rows, cols, j, i;

	  // Make sure arr is in matrix format.
	  if (!isArray(arr[0]))
	    arr = [arr];

	  rows = arr.length;
	  cols = arr[0].length;

	  for (var i = 0; i < cols; i++) {
	    objArr = new Array(rows);
	    for (j = 0; j < rows; j++)
	      objArr[j] = arr[j][i];
	    obj.push(objArr);
	  }

	  // If obj is vector, return only single array.
	  return obj.length === 1 ? obj[0] : obj;
	};


	// Map a function to an array or array of arrays.
	// "toAlter" is an internal variable.
	jStat.map = function map(arr, func, toAlter) {
	  var row, nrow, ncol, res, col;

	  if (!isArray(arr[0]))
	    arr = [arr];

	  nrow = arr.length;
	  ncol = arr[0].length;
	  res = toAlter ? arr : new Array(nrow);

	  for (row = 0; row < nrow; row++) {
	    // if the row doesn't exist, create it
	    if (!res[row])
	      res[row] = new Array(ncol);
	    for (col = 0; col < ncol; col++)
	      res[row][col] = func(arr[row][col], row, col);
	  }

	  return res.length === 1 ? res[0] : res;
	};


	// Cumulatively combine the elements of an array or array of arrays using a function.
	jStat.cumreduce = function cumreduce(arr, func, toAlter) {
	  var row, nrow, ncol, res, col;

	  if (!isArray(arr[0]))
	    arr = [arr];

	  nrow = arr.length;
	  ncol = arr[0].length;
	  res = toAlter ? arr : new Array(nrow);

	  for (row = 0; row < nrow; row++) {
	    // if the row doesn't exist, create it
	    if (!res[row])
	      res[row] = new Array(ncol);
	    if (ncol > 0)
	      res[row][0] = arr[row][0];
	    for (col = 1; col < ncol; col++)
	      res[row][col] = func(res[row][col-1], arr[row][col]);
	  }
	  return res.length === 1 ? res[0] : res;
	};


	// Destructively alter an array.
	jStat.alter = function alter(arr, func) {
	  return jStat.map(arr, func, true);
	};


	// Generate a rows x cols matrix according to the supplied function.
	jStat.create = function  create(rows, cols, func) {
	  var res = new Array(rows);
	  var i, j;

	  if (isFunction(cols)) {
	    func = cols;
	    cols = rows;
	  }

	  for (var i = 0; i < rows; i++) {
	    res[i] = new Array(cols);
	    for (j = 0; j < cols; j++)
	      res[i][j] = func(i, j);
	  }

	  return res;
	};


	function retZero() { return 0; }


	// Generate a rows x cols matrix of zeros.
	jStat.zeros = function zeros(rows, cols) {
	  if (!isNumber(cols))
	    cols = rows;
	  return jStat.create(rows, cols, retZero);
	};


	function retOne() { return 1; }


	// Generate a rows x cols matrix of ones.
	jStat.ones = function ones(rows, cols) {
	  if (!isNumber(cols))
	    cols = rows;
	  return jStat.create(rows, cols, retOne);
	};


	// Generate a rows x cols matrix of uniformly random numbers.
	jStat.rand = function rand(rows, cols) {
	  if (!isNumber(cols))
	    cols = rows;
	  return jStat.create(rows, cols, Math.random);
	};


	function retIdent(i, j) { return i === j ? 1 : 0; }


	// Generate an identity matrix of size row x cols.
	jStat.identity = function identity(rows, cols) {
	  if (!isNumber(cols))
	    cols = rows;
	  return jStat.create(rows, cols, retIdent);
	};


	// Tests whether a matrix is symmetric
	jStat.symmetric = function symmetric(arr) {
	  var issymmetric = true;
	  var size = arr.length;
	  var row, col;

	  if (arr.length !== arr[0].length)
	    return false;

	  for (row = 0; row < size; row++) {
	    for (col = 0; col < size; col++)
	      if (arr[col][row] !== arr[row][col])
	        return false;
	  }

	  return true;
	};


	// Set all values to zero.
	jStat.clear = function clear(arr) {
	  return jStat.alter(arr, retZero);
	};


	// Generate sequence.
	jStat.seq = function seq(min, max, length, func) {
	  if (!isFunction(func))
	    func = false;

	  var arr = [];
	  var hival = calcRdx(min, max);
	  var step = (max * hival - min * hival) / ((length - 1) * hival);
	  var current = min;
	  var cnt;

	  // Current is assigned using a technique to compensate for IEEE error.
	  // TODO: Needs better implementation.
	  for (cnt = 0;
	       current <= max && cnt < length;
	       cnt++, current = (min * hival + step * hival * cnt) / hival) {
	    arr.push((func ? func(current, cnt) : current));
	  }

	  return arr;
	};


	// arange(5) -> [0,1,2,3,4]
	// arange(1,5) -> [1,2,3,4]
	// arange(5,1,-1) -> [5,4,3,2]
	jStat.arange = function arange(start, end, step) {
	  var rl = [];
	  step = step || 1;
	  if (end === undefined) {
	    end = start;
	    start = 0;
	  }
	  if (start === end || step === 0) {
	    return [];
	  }
	  if (start < end && step < 0) {
	    return [];
	  }
	  if (start > end && step > 0) {
	    return [];
	  }
	  if (step > 0) {
	    for (i = start; i < end; i += step) {
	      rl.push(i);
	    }
	  } else {
	    for (i = start; i > end; i += step) {
	      rl.push(i);
	    }
	  }
	  return rl;
	};


	// A=[[1,2,3],[4,5,6],[7,8,9]]
	// slice(A,{row:{end:2},col:{start:1}}) -> [[2,3],[5,6]]
	// slice(A,1,{start:1}) -> [5,6]
	// as numpy code A[:2,1:]
	jStat.slice = (function(){
	  function _slice(list, start, end, step) {
	    // note it's not equal to range.map mode it's a bug
	    var i;
	    var rl = [];
	    var length = list.length;
	    if (start === undefined && end === undefined && step === undefined) {
	      return jStat.copy(list);
	    }

	    start = start || 0;
	    end = end || list.length;
	    start = start >= 0 ? start : length + start;
	    end = end >= 0 ? end : length + end;
	    step = step || 1;
	    if (start === end || step === 0) {
	      return [];
	    }
	    if (start < end && step < 0) {
	      return [];
	    }
	    if (start > end && step > 0) {
	      return [];
	    }
	    if (step > 0) {
	      for (i = start; i < end; i += step) {
	        rl.push(list[i]);
	      }
	    } else {
	      for (i = start; i > end;i += step) {
	        rl.push(list[i]);
	      }
	    }
	    return rl;
	  }

	  function slice(list, rcSlice) {
	    rcSlice = rcSlice || {};
	    if (isNumber(rcSlice.row)) {
	      if (isNumber(rcSlice.col))
	        return list[rcSlice.row][rcSlice.col];
	      var row = jStat.rowa(list, rcSlice.row);
	      var colSlice = rcSlice.col || {};
	      return _slice(row, colSlice.start, colSlice.end, colSlice.step);
	    }

	    if (isNumber(rcSlice.col)) {
	      var col = jStat.cola(list, rcSlice.col);
	      var rowSlice = rcSlice.row || {};
	      return _slice(col, rowSlice.start, rowSlice.end, rowSlice.step);
	    }

	    var rowSlice = rcSlice.row || {};
	    var colSlice = rcSlice.col || {};
	    var rows = _slice(list, rowSlice.start, rowSlice.end, rowSlice.step);
	    return rows.map(function(row) {
	      return _slice(row, colSlice.start, colSlice.end, colSlice.step);
	    });
	  }

	  return slice;
	}());


	// A=[[1,2,3],[4,5,6],[7,8,9]]
	// sliceAssign(A,{row:{start:1},col:{start:1}},[[0,0],[0,0]])
	// A=[[1,2,3],[4,0,0],[7,0,0]]
	jStat.sliceAssign = function sliceAssign(A, rcSlice, B) {
	  if (isNumber(rcSlice.row)) {
	    if (isNumber(rcSlice.col))
	      return A[rcSlice.row][rcSlice.col] = B;
	    rcSlice.col = rcSlice.col || {};
	    rcSlice.col.start = rcSlice.col.start || 0;
	    rcSlice.col.end = rcSlice.col.end || A[0].length;
	    rcSlice.col.step = rcSlice.col.step || 1;
	    var nl = jStat.arange(rcSlice.col.start,
	                          Math.min(A.length, rcSlice.col.end),
	                          rcSlice.col.step);
	    var m = rcSlice.row;
	    nl.forEach(function(n, i) {
	      A[m][n] = B[i];
	    });
	    return A;
	  }

	  if (isNumber(rcSlice.col)) {
	    rcSlice.row = rcSlice.row || {};
	    rcSlice.row.start = rcSlice.row.start || 0;
	    rcSlice.row.end = rcSlice.row.end || A.length;
	    rcSlice.row.step = rcSlice.row.step || 1;
	    var ml = jStat.arange(rcSlice.row.start,
	                          Math.min(A[0].length, rcSlice.row.end),
	                          rcSlice.row.step);
	    var n = rcSlice.col;
	    ml.forEach(function(m, j) {
	      A[m][n] = B[j];
	    });
	    return A;
	  }

	  if (B[0].length === undefined) {
	    B = [B];
	  }
	  rcSlice.row.start = rcSlice.row.start || 0;
	  rcSlice.row.end = rcSlice.row.end || A.length;
	  rcSlice.row.step = rcSlice.row.step || 1;
	  rcSlice.col.start = rcSlice.col.start || 0;
	  rcSlice.col.end = rcSlice.col.end || A[0].length;
	  rcSlice.col.step = rcSlice.col.step || 1;
	  var ml = jStat.arange(rcSlice.row.start,
	                        Math.min(A.length, rcSlice.row.end),
	                        rcSlice.row.step);
	  var nl = jStat.arange(rcSlice.col.start,
	                        Math.min(A[0].length, rcSlice.col.end),
	                        rcSlice.col.step);
	  ml.forEach(function(m, i) {
	    nl.forEach(function(n, j) {
	      A[m][n] = B[i][j];
	    });
	  });
	  return A;
	};


	// [1,2,3] ->
	// [[1,0,0],[0,2,0],[0,0,3]]
	jStat.diagonal = function diagonal(diagArray) {
	  var mat = jStat.zeros(diagArray.length, diagArray.length);
	  diagArray.forEach(function(t, i) {
	    mat[i][i] = t;
	  });
	  return mat;
	};


	// return copy of A
	jStat.copy = function copy(A) {
	  return A.map(function(row) {
	    if (isNumber(row))
	      return row;
	    return row.map(function(t) {
	      return t;
	    });
	  });
	};


	// TODO: Go over this entire implementation. Seems a tragic waste of resources
	// doing all this work. Instead, and while ugly, use new Function() to generate
	// a custom function for each static method.

	// Quick reference.
	var jProto = jStat.prototype;

	// Default length.
	jProto.length = 0;

	// For internal use only.
	// TODO: Check if they're actually used, and if they are then rename them
	// to _*
	jProto.push = Array.prototype.push;
	jProto.sort = Array.prototype.sort;
	jProto.splice = Array.prototype.splice;
	jProto.slice = Array.prototype.slice;


	// Return a clean array.
	jProto.toArray = function toArray() {
	  return this.length > 1 ? slice.call(this) : slice.call(this)[0];
	};


	// Map a function to a matrix or vector.
	jProto.map = function map(func, toAlter) {
	  return jStat(jStat.map(this, func, toAlter));
	};


	// Cumulatively combine the elements of a matrix or vector using a function.
	jProto.cumreduce = function cumreduce(func, toAlter) {
	  return jStat(jStat.cumreduce(this, func, toAlter));
	};


	// Destructively alter an array.
	jProto.alter = function alter(func) {
	  jStat.alter(this, func);
	  return this;
	};


	// Extend prototype with methods that have no argument.
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jProto[passfunc] = function(func) {
	      var self = this,
	      results;
	      // Check for callback.
	      if (func) {
	        setTimeout(function() {
	          func.call(self, jProto[passfunc].call(self));
	        });
	        return this;
	      }
	      results = jStat[passfunc](this);
	      return isArray(results) ? jStat(results) : results;
	    };
	  })(funcs[i]);
	})('transpose clear symmetric rows cols dimensions diag antidiag'.split(' '));


	// Extend prototype with methods that have one argument.
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jProto[passfunc] = function(index, func) {
	      var self = this;
	      // check for callback
	      if (func) {
	        setTimeout(function() {
	          func.call(self, jProto[passfunc].call(self, index));
	        });
	        return this;
	      }
	      return jStat(jStat[passfunc](this, index));
	    };
	  })(funcs[i]);
	})('row col'.split(' '));


	// Extend prototype with simple shortcut methods.
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jProto[passfunc] = new Function(
	        'return jStat(jStat.' + passfunc + '.apply(null, arguments));');
	  })(funcs[i]);
	})('create zeros ones rand identity'.split(' '));


	// Exposing jStat.
	return jStat;

	}(Math));
	(function(jStat, Math) {

	var isFunction = jStat.utils.isFunction;

	// Ascending functions for sort
	function ascNum(a, b) { return a - b; }

	function clip(arg, min, max) {
	  return Math.max(min, Math.min(arg, max));
	}


	// sum of an array
	jStat.sum = function sum(arr) {
	  var sum = 0;
	  var i = arr.length;
	  while (--i >= 0)
	    sum += arr[i];
	  return sum;
	};


	// sum squared
	jStat.sumsqrd = function sumsqrd(arr) {
	  var sum = 0;
	  var i = arr.length;
	  while (--i >= 0)
	    sum += arr[i] * arr[i];
	  return sum;
	};


	// sum of squared errors of prediction (SSE)
	jStat.sumsqerr = function sumsqerr(arr) {
	  var mean = jStat.mean(arr);
	  var sum = 0;
	  var i = arr.length;
	  var tmp;
	  while (--i >= 0) {
	    tmp = arr[i] - mean;
	    sum += tmp * tmp;
	  }
	  return sum;
	};

	// sum of an array in each row
	jStat.sumrow = function sumrow(arr) {
	  var sum = 0;
	  var i = arr.length;
	  while (--i >= 0)
	    sum += arr[i];
	  return sum;
	};

	// product of an array
	jStat.product = function product(arr) {
	  var prod = 1;
	  var i = arr.length;
	  while (--i >= 0)
	    prod *= arr[i];
	  return prod;
	};


	// minimum value of an array
	jStat.min = function min(arr) {
	  var low = arr[0];
	  var i = 0;
	  while (++i < arr.length)
	    if (arr[i] < low)
	      low = arr[i];
	  return low;
	};


	// maximum value of an array
	jStat.max = function max(arr) {
	  var high = arr[0];
	  var i = 0;
	  while (++i < arr.length)
	    if (arr[i] > high)
	      high = arr[i];
	  return high;
	};


	// unique values of an array
	jStat.unique = function unique(arr) {
	  var hash = {}, _arr = [];
	  for(var i = 0; i < arr.length; i++) {
	    if (!hash[arr[i]]) {
	      hash[arr[i]] = true;
	      _arr.push(arr[i]);
	    }
	  }
	  return _arr;
	};


	// mean value of an array
	jStat.mean = function mean(arr) {
	  return jStat.sum(arr) / arr.length;
	};


	// mean squared error (MSE)
	jStat.meansqerr = function meansqerr(arr) {
	  return jStat.sumsqerr(arr) / arr.length;
	};


	// geometric mean of an array
	jStat.geomean = function geomean(arr) {
	  return Math.pow(jStat.product(arr), 1 / arr.length);
	};


	// median of an array
	jStat.median = function median(arr) {
	  var arrlen = arr.length;
	  var _arr = arr.slice().sort(ascNum);
	  // check if array is even or odd, then return the appropriate
	  return !(arrlen & 1)
	    ? (_arr[(arrlen / 2) - 1 ] + _arr[(arrlen / 2)]) / 2
	    : _arr[(arrlen / 2) | 0 ];
	};


	// cumulative sum of an array
	jStat.cumsum = function cumsum(arr) {
	  return jStat.cumreduce(arr, function (a, b) { return a + b; });
	};


	// cumulative product of an array
	jStat.cumprod = function cumprod(arr) {
	  return jStat.cumreduce(arr, function (a, b) { return a * b; });
	};


	// successive differences of a sequence
	jStat.diff = function diff(arr) {
	  var diffs = [];
	  var arrLen = arr.length;
	  var i;
	  for (var i = 1; i < arrLen; i++)
	    diffs.push(arr[i] - arr[i - 1]);
	  return diffs;
	};


	// ranks of an array
	jStat.rank = function (arr) {
	  var arrlen = arr.length;
	  var sorted = arr.slice().sort(ascNum);
	  var ranks = new Array(arrlen);
	  for (var i = 0; i < arrlen; i++) {
	    var first = sorted.indexOf(arr[i]);
	    var last = sorted.lastIndexOf(arr[i]);
	    if (first === last) {
	      var val = first;
	    } else {
	      var val = (first + last) / 2;
	    }
	    ranks[i] = val + 1;
	  }
	  return ranks;
	};


	// mode of an array
	// if there are multiple modes of an array, return all of them
	// is this the appropriate way of handling it?
	jStat.mode = function mode(arr) {
	  var arrLen = arr.length;
	  var _arr = arr.slice().sort(ascNum);
	  var count = 1;
	  var maxCount = 0;
	  var numMaxCount = 0;
	  var mode_arr = [];
	  var i;

	  for (var i = 0; i < arrLen; i++) {
	    if (_arr[i] === _arr[i + 1]) {
	      count++;
	    } else {
	      if (count > maxCount) {
	        mode_arr = [_arr[i]];
	        maxCount = count;
	        numMaxCount = 0;
	      }
	      // are there multiple max counts
	      else if (count === maxCount) {
	        mode_arr.push(_arr[i]);
	        numMaxCount++;
	      }
	      // resetting count for new value in array
	      count = 1;
	    }
	  }

	  return numMaxCount === 0 ? mode_arr[0] : mode_arr;
	};


	// range of an array
	jStat.range = function range(arr) {
	  return jStat.max(arr) - jStat.min(arr);
	};

	// variance of an array
	// flag = true indicates sample instead of population
	jStat.variance = function variance(arr, flag) {
	  return jStat.sumsqerr(arr) / (arr.length - (flag ? 1 : 0));
	};

	// pooled variance of an array of arrays
	jStat.pooledvariance = function pooledvariance(arr) {
	  var sumsqerr = arr.reduce(function (a, samples) {return a + jStat.sumsqerr(samples);}, 0);
	  var count = arr.reduce(function (a, samples) {return a + samples.length;}, 0);
	  return sumsqerr / (count - arr.length);
	};

	// deviation of an array
	jStat.deviation = function (arr) {
	  var mean = jStat.mean(arr);
	  var arrlen = arr.length;
	  var dev = new Array(arrlen);
	  for (var i = 0; i < arrlen; i++) {
	    dev[i] = arr[i] - mean;
	  }
	  return dev;
	};

	// standard deviation of an array
	// flag = true indicates sample instead of population
	jStat.stdev = function stdev(arr, flag) {
	  return Math.sqrt(jStat.variance(arr, flag));
	};

	// pooled standard deviation of an array of arrays
	jStat.pooledstdev = function pooledstdev(arr) {
	  return Math.sqrt(jStat.pooledvariance(arr));
	};

	// mean deviation (mean absolute deviation) of an array
	jStat.meandev = function meandev(arr) {
	  var mean = jStat.mean(arr);
	  var a = [];
	  for (var i = arr.length - 1; i >= 0; i--) {
	    a.push(Math.abs(arr[i] - mean));
	  }
	  return jStat.mean(a);
	};


	// median deviation (median absolute deviation) of an array
	jStat.meddev = function meddev(arr) {
	  var median = jStat.median(arr);
	  var a = [];
	  for (var i = arr.length - 1; i >= 0; i--) {
	    a.push(Math.abs(arr[i] - median));
	  }
	  return jStat.median(a);
	};


	// coefficient of variation
	jStat.coeffvar = function coeffvar(arr) {
	  return jStat.stdev(arr) / jStat.mean(arr);
	};


	// quartiles of an array
	jStat.quartiles = function quartiles(arr) {
	  var arrlen = arr.length;
	  var _arr = arr.slice().sort(ascNum);
	  return [
	    _arr[ Math.round((arrlen) / 4) - 1 ],
	    _arr[ Math.round((arrlen) / 2) - 1 ],
	    _arr[ Math.round((arrlen) * 3 / 4) - 1 ]
	  ];
	};


	// Arbitary quantiles of an array. Direct port of the scipy.stats
	// implementation by Pierre GF Gerard-Marchant.
	jStat.quantiles = function quantiles(arr, quantilesArray, alphap, betap) {
	  var sortedArray = arr.slice().sort(ascNum);
	  var quantileVals = [quantilesArray.length];
	  var n = arr.length;
	  var i, p, m, aleph, k, gamma;

	  if (typeof alphap === 'undefined')
	    alphap = 3 / 8;
	  if (typeof betap === 'undefined')
	    betap = 3 / 8;

	  for (var i = 0; i < quantilesArray.length; i++) {
	    p = quantilesArray[i];
	    m = alphap + p * (1 - alphap - betap);
	    aleph = n * p + m;
	    k = Math.floor(clip(aleph, 1, n - 1));
	    gamma = clip(aleph - k, 0, 1);
	    quantileVals[i] = (1 - gamma) * sortedArray[k - 1] + gamma * sortedArray[k];
	  }

	  return quantileVals;
	};

	// Returns the k-th percentile of values in a range, where k is in the
	// range 0..1, exclusive.
	jStat.percentile = function percentile(arr, k) {
	  var _arr = arr.slice().sort(ascNum);
	  var realIndex = k * (_arr.length - 1);
	  var index = parseInt(realIndex);
	  var frac = realIndex - index;

	  if (index + 1 < _arr.length) {
	    return _arr[index] * (1 - frac) + _arr[index + 1] * frac;
	  } else {
	    return _arr[index];
	  }
	}


	// The percentile rank of score in a given array. Returns the percentage
	// of all values in the input array that are less than (kind='strict') or
	// less or equal than (kind='weak') score. Default is weak.
	jStat.percentileOfScore = function percentileOfScore(arr, score, kind) {
	  var counter = 0;
	  var len = arr.length;
	  var strict = false;
	  var value, i;

	  if (kind === 'strict')
	    strict = true;

	  for (var i = 0; i < len; i++) {
	    value = arr[i];
	    if ((strict && value < score) ||
	        (!strict && value <= score)) {
	      counter++;
	    }
	  }

	  return counter / len;
	};


	// Histogram (bin count) data
	jStat.histogram = function histogram(arr, bins) {
	  var first = jStat.min(arr);
	  var binCnt = bins || 4;
	  var binWidth = (jStat.max(arr) - first) / binCnt;
	  var len = arr.length;
	  var bins = [];
	  var i;

	  for (var i = 0; i < binCnt; i++)
	    bins[i] = 0;
	  for (var i = 0; i < len; i++)
	    bins[Math.min(Math.floor(((arr[i] - first) / binWidth)), binCnt - 1)] += 1;

	  return bins;
	};


	// covariance of two arrays
	jStat.covariance = function covariance(arr1, arr2) {
	  var u = jStat.mean(arr1);
	  var v = jStat.mean(arr2);
	  var arr1Len = arr1.length;
	  var sq_dev = new Array(arr1Len);
	  var i;

	  for (var i = 0; i < arr1Len; i++)
	    sq_dev[i] = (arr1[i] - u) * (arr2[i] - v);

	  return jStat.sum(sq_dev) / (arr1Len - 1);
	};


	// (pearson's) population correlation coefficient, rho
	jStat.corrcoeff = function corrcoeff(arr1, arr2) {
	  return jStat.covariance(arr1, arr2) /
	      jStat.stdev(arr1, 1) /
	      jStat.stdev(arr2, 1);
	};

	  // (spearman's) rank correlation coefficient, sp
	jStat.spearmancoeff =  function (arr1, arr2) {
	  arr1 = jStat.rank(arr1);
	  arr2 = jStat.rank(arr2);
	  //return pearson's correlation of the ranks:
	  return jStat.corrcoeff(arr1, arr2);
	}


	// statistical standardized moments (general form of skew/kurt)
	jStat.stanMoment = function stanMoment(arr, n) {
	  var mu = jStat.mean(arr);
	  var sigma = jStat.stdev(arr);
	  var len = arr.length;
	  var skewSum = 0;

	  for (var i = 0; i < len; i++)
	    skewSum += Math.pow((arr[i] - mu) / sigma, n);

	  return skewSum / arr.length;
	};

	// (pearson's) moment coefficient of skewness
	jStat.skewness = function skewness(arr) {
	  return jStat.stanMoment(arr, 3);
	};

	// (pearson's) (excess) kurtosis
	jStat.kurtosis = function kurtosis(arr) {
	  return jStat.stanMoment(arr, 4) - 3;
	};


	var jProto = jStat.prototype;


	// Extend jProto with method for calculating cumulative sums and products.
	// This differs from the similar extension below as cumsum and cumprod should
	// not be run again in the case fullbool === true.
	// If a matrix is passed, automatically assume operation should be done on the
	// columns.
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    // If a matrix is passed, automatically assume operation should be done on
	    // the columns.
	    jProto[passfunc] = function(fullbool, func) {
	      var arr = [];
	      var i = 0;
	      var tmpthis = this;
	      // Assignment reassignation depending on how parameters were passed in.
	      if (isFunction(fullbool)) {
	        func = fullbool;
	        fullbool = false;
	      }
	      // Check if a callback was passed with the function.
	      if (func) {
	        setTimeout(function() {
	          func.call(tmpthis, jProto[passfunc].call(tmpthis, fullbool));
	        });
	        return this;
	      }
	      // Check if matrix and run calculations.
	      if (this.length > 1) {
	        tmpthis = fullbool === true ? this : this.transpose();
	        for (; i < tmpthis.length; i++)
	          arr[i] = jStat[passfunc](tmpthis[i]);
	        return arr;
	      }
	      // Pass fullbool if only vector, not a matrix. for variance and stdev.
	      return jStat[passfunc](this[0], fullbool);
	    };
	  })(funcs[i]);
	})(('cumsum cumprod').split(' '));


	// Extend jProto with methods which don't require arguments and work on columns.
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    // If a matrix is passed, automatically assume operation should be done on
	    // the columns.
	    jProto[passfunc] = function(fullbool, func) {
	      var arr = [];
	      var i = 0;
	      var tmpthis = this;
	      // Assignment reassignation depending on how parameters were passed in.
	      if (isFunction(fullbool)) {
	        func = fullbool;
	        fullbool = false;
	      }
	      // Check if a callback was passed with the function.
	      if (func) {
	        setTimeout(function() {
	          func.call(tmpthis, jProto[passfunc].call(tmpthis, fullbool));
	        });
	        return this;
	      }
	      // Check if matrix and run calculations.
	      if (this.length > 1) {
	        if (passfunc !== 'sumrow')
	          tmpthis = fullbool === true ? this : this.transpose();
	        for (; i < tmpthis.length; i++)
	          arr[i] = jStat[passfunc](tmpthis[i]);
	        return fullbool === true
	            ? jStat[passfunc](jStat.utils.toVector(arr))
	            : arr;
	      }
	      // Pass fullbool if only vector, not a matrix. for variance and stdev.
	      return jStat[passfunc](this[0], fullbool);
	    };
	  })(funcs[i]);
	})(('sum sumsqrd sumsqerr sumrow product min max unique mean meansqerr ' +
	    'geomean median diff rank mode range variance deviation stdev meandev ' +
	    'meddev coeffvar quartiles histogram skewness kurtosis').split(' '));


	// Extend jProto with functions that take arguments. Operations on matrices are
	// done on columns.
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jProto[passfunc] = function() {
	      var arr = [];
	      var i = 0;
	      var tmpthis = this;
	      var args = Array.prototype.slice.call(arguments);

	      // If the last argument is a function, we assume it's a callback; we
	      // strip the callback out and call the function again.
	      if (isFunction(args[args.length - 1])) {
	        var callbackFunction = args[args.length - 1];
	        var argsToPass = args.slice(0, args.length - 1);

	        setTimeout(function() {
	          callbackFunction.call(tmpthis,
	                                jProto[passfunc].apply(tmpthis, argsToPass));
	        });
	        return this;

	      // Otherwise we curry the function args and call normally.
	      } else {
	        var callbackFunction = undefined;
	        var curriedFunction = function curriedFunction(vector) {
	          return jStat[passfunc].apply(tmpthis, [vector].concat(args));
	        }
	      }

	      // If this is a matrix, run column-by-column.
	      if (this.length > 1) {
	        tmpthis = tmpthis.transpose();
	        for (; i < tmpthis.length; i++)
	          arr[i] = curriedFunction(tmpthis[i]);
	        return arr;
	      }

	      // Otherwise run on the vector.
	      return curriedFunction(this[0]);
	    };
	  })(funcs[i]);
	})('quantiles percentileOfScore'.split(' '));

	}(jStat, Math));
	// Special functions //
	(function(jStat, Math) {

	// Log-gamma function
	jStat.gammaln = function gammaln(x) {
	  var j = 0;
	  var cof = [
	    76.18009172947146, -86.50532032941677, 24.01409824083091,
	    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
	  ];
	  var ser = 1.000000000190015;
	  var xx, y, tmp;
	  tmp = (y = xx = x) + 5.5;
	  tmp -= (xx + 0.5) * Math.log(tmp);
	  for (; j < 6; j++)
	    ser += cof[j] / ++y;
	  return Math.log(2.5066282746310005 * ser / xx) - tmp;
	};


	// gamma of x
	jStat.gammafn = function gammafn(x) {
	  var p = [-1.716185138865495, 24.76565080557592, -379.80425647094563,
	           629.3311553128184, 866.9662027904133, -31451.272968848367,
	           -36144.413418691176, 66456.14382024054
	  ];
	  var q = [-30.8402300119739, 315.35062697960416, -1015.1563674902192,
	           -3107.771671572311, 22538.118420980151, 4755.8462775278811,
	           -134659.9598649693, -115132.2596755535];
	  var fact = false;
	  var n = 0;
	  var xden = 0;
	  var xnum = 0;
	  var y = x;
	  var i, z, yi, res, sum, ysq;
	  if (y <= 0) {
	    res = y % 1 + 3.6e-16;
	    if (res) {
	      fact = (!(y & 1) ? 1 : -1) * Math.PI / Math.sin(Math.PI * res);
	      y = 1 - y;
	    } else {
	      return Infinity;
	    }
	  }
	  yi = y;
	  if (y < 1) {
	    z = y++;
	  } else {
	    z = (y -= n = (y | 0) - 1) - 1;
	  }
	  for (var i = 0; i < 8; ++i) {
	    xnum = (xnum + p[i]) * z;
	    xden = xden * z + q[i];
	  }
	  res = xnum / xden + 1;
	  if (yi < y) {
	    res /= yi;
	  } else if (yi > y) {
	    for (var i = 0; i < n; ++i) {
	      res *= y;
	      y++;
	    }
	  }
	  if (fact) {
	    res = fact / res;
	  }
	  return res;
	};


	// lower incomplete gamma function, which is usually typeset with a
	// lower-case greek gamma as the function symbol
	jStat.gammap = function gammap(a, x) {
	  return jStat.lowRegGamma(a, x) * jStat.gammafn(a);
	};


	// The lower regularized incomplete gamma function, usually written P(a,x)
	jStat.lowRegGamma = function lowRegGamma(a, x) {
	  var aln = jStat.gammaln(a);
	  var ap = a;
	  var sum = 1 / a;
	  var del = sum;
	  var b = x + 1 - a;
	  var c = 1 / 1.0e-30;
	  var d = 1 / b;
	  var h = d;
	  var i = 1;
	  // calculate maximum number of itterations required for a
	  var ITMAX = -~(Math.log((a >= 1) ? a : 1 / a) * 8.5 + a * 0.4 + 17);
	  var an, endval;

	  if (x < 0 || a <= 0) {
	    return NaN;
	  } else if (x < a + 1) {
	    for (; i <= ITMAX; i++) {
	      sum += del *= x / ++ap;
	    }
	    return (sum * Math.exp(-x + a * Math.log(x) - (aln)));
	  }

	  for (; i <= ITMAX; i++) {
	    an = -i * (i - a);
	    b += 2;
	    d = an * d + b;
	    c = b + an / c;
	    d = 1 / d;
	    h *= d * c;
	  }

	  return (1 - h * Math.exp(-x + a * Math.log(x) - (aln)));
	};

	// natural log factorial of n
	jStat.factorialln = function factorialln(n) {
	  return n < 0 ? NaN : jStat.gammaln(n + 1);
	};

	// factorial of n
	jStat.factorial = function factorial(n) {
	  return n < 0 ? NaN : jStat.gammafn(n + 1);
	};

	// combinations of n, m
	jStat.combination = function combination(n, m) {
	  // make sure n or m don't exceed the upper limit of usable values
	  return (n > 170 || m > 170)
	      ? Math.exp(jStat.combinationln(n, m))
	      : (jStat.factorial(n) / jStat.factorial(m)) / jStat.factorial(n - m);
	};


	jStat.combinationln = function combinationln(n, m){
	  return jStat.factorialln(n) - jStat.factorialln(m) - jStat.factorialln(n - m);
	};


	// permutations of n, m
	jStat.permutation = function permutation(n, m) {
	  return jStat.factorial(n) / jStat.factorial(n - m);
	};


	// beta function
	jStat.betafn = function betafn(x, y) {
	  // ensure arguments are positive
	  if (x <= 0 || y <= 0)
	    return undefined;
	  // make sure x + y doesn't exceed the upper limit of usable values
	  return (x + y > 170)
	      ? Math.exp(jStat.betaln(x, y))
	      : jStat.gammafn(x) * jStat.gammafn(y) / jStat.gammafn(x + y);
	};


	// natural logarithm of beta function
	jStat.betaln = function betaln(x, y) {
	  return jStat.gammaln(x) + jStat.gammaln(y) - jStat.gammaln(x + y);
	};


	// Evaluates the continued fraction for incomplete beta function by modified
	// Lentz's method.
	jStat.betacf = function betacf(x, a, b) {
	  var fpmin = 1e-30;
	  var m = 1;
	  var qab = a + b;
	  var qap = a + 1;
	  var qam = a - 1;
	  var c = 1;
	  var d = 1 - qab * x / qap;
	  var m2, aa, del, h;

	  // These q's will be used in factors that occur in the coefficients
	  if (Math.abs(d) < fpmin)
	    d = fpmin;
	  d = 1 / d;
	  h = d;

	  for (; m <= 100; m++) {
	    m2 = 2 * m;
	    aa = m * (b - m) * x / ((qam + m2) * (a + m2));
	    // One step (the even one) of the recurrence
	    d = 1 + aa * d;
	    if (Math.abs(d) < fpmin)
	      d = fpmin;
	    c = 1 + aa / c;
	    if (Math.abs(c) < fpmin)
	      c = fpmin;
	    d = 1 / d;
	    h *= d * c;
	    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
	    // Next step of the recurrence (the odd one)
	    d = 1 + aa * d;
	    if (Math.abs(d) < fpmin)
	      d = fpmin;
	    c = 1 + aa / c;
	    if (Math.abs(c) < fpmin)
	      c = fpmin;
	    d = 1 / d;
	    del = d * c;
	    h *= del;
	    if (Math.abs(del - 1.0) < 3e-7)
	      break;
	  }

	  return h;
	};


	// Returns the inverse of the lower regularized inomplete gamma function
	jStat.gammapinv = function gammapinv(p, a) {
	  var j = 0;
	  var a1 = a - 1;
	  var EPS = 1e-8;
	  var gln = jStat.gammaln(a);
	  var x, err, t, u, pp, lna1, afac;

	  if (p >= 1)
	    return Math.max(100, a + 100 * Math.sqrt(a));
	  if (p <= 0)
	    return 0;
	  if (a > 1) {
	    lna1 = Math.log(a1);
	    afac = Math.exp(a1 * (lna1 - 1) - gln);
	    pp = (p < 0.5) ? p : 1 - p;
	    t = Math.sqrt(-2 * Math.log(pp));
	    x = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
	    if (p < 0.5)
	      x = -x;
	    x = Math.max(1e-3,
	                 a * Math.pow(1 - 1 / (9 * a) - x / (3 * Math.sqrt(a)), 3));
	  } else {
	    t = 1 - a * (0.253 + a * 0.12);
	    if (p < t)
	      x = Math.pow(p / t, 1 / a);
	    else
	      x = 1 - Math.log(1 - (p - t) / (1 - t));
	  }

	  for(; j < 12; j++) {
	    if (x <= 0)
	      return 0;
	    err = jStat.lowRegGamma(a, x) - p;
	    if (a > 1)
	      t = afac * Math.exp(-(x - a1) + a1 * (Math.log(x) - lna1));
	    else
	      t = Math.exp(-x + a1 * Math.log(x) - gln);
	    u = err / t;
	    x -= (t = u / (1 - 0.5 * Math.min(1, u * ((a - 1) / x - 1))));
	    if (x <= 0)
	      x = 0.5 * (x + t);
	    if (Math.abs(t) < EPS * x)
	      break;
	  }

	  return x;
	};


	// Returns the error function erf(x)
	jStat.erf = function erf(x) {
	  var cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
	             -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
	             4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
	             1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
	             6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
	             -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
	             -6.886027e-12, 8.94487e-13, 3.13092e-13,
	             -1.12708e-13, 3.81e-16, 7.106e-15,
	             -1.523e-15, -9.4e-17, 1.21e-16,
	             -2.8e-17];
	  var j = cof.length - 1;
	  var isneg = false;
	  var d = 0;
	  var dd = 0;
	  var t, ty, tmp, res;

	  if (x < 0) {
	    x = -x;
	    isneg = true;
	  }

	  t = 2 / (2 + x);
	  ty = 4 * t - 2;

	  for(; j > 0; j--) {
	    tmp = d;
	    d = ty * d - dd + cof[j];
	    dd = tmp;
	  }

	  res = t * Math.exp(-x * x + 0.5 * (cof[0] + ty * d) - dd);
	  return isneg ? res - 1 : 1 - res;
	};


	// Returns the complmentary error function erfc(x)
	jStat.erfc = function erfc(x) {
	  return 1 - jStat.erf(x);
	};


	// Returns the inverse of the complementary error function
	jStat.erfcinv = function erfcinv(p) {
	  var j = 0;
	  var x, err, t, pp;
	  if (p >= 2)
	    return -100;
	  if (p <= 0)
	    return 100;
	  pp = (p < 1) ? p : 2 - p;
	  t = Math.sqrt(-2 * Math.log(pp / 2));
	  x = -0.70711 * ((2.30753 + t * 0.27061) /
	                  (1 + t * (0.99229 + t * 0.04481)) - t);
	  for (; j < 2; j++) {
	    err = jStat.erfc(x) - pp;
	    x += err / (1.12837916709551257 * Math.exp(-x * x) - x * err);
	  }
	  return (p < 1) ? x : -x;
	};


	// Returns the inverse of the incomplete beta function
	jStat.ibetainv = function ibetainv(p, a, b) {
	  var EPS = 1e-8;
	  var a1 = a - 1;
	  var b1 = b - 1;
	  var j = 0;
	  var lna, lnb, pp, t, u, err, x, al, h, w, afac;
	  if (p <= 0)
	    return 0;
	  if (p >= 1)
	    return 1;
	  if (a >= 1 && b >= 1) {
	    pp = (p < 0.5) ? p : 1 - p;
	    t = Math.sqrt(-2 * Math.log(pp));
	    x = (2.30753 + t * 0.27061) / (1 + t* (0.99229 + t * 0.04481)) - t;
	    if (p < 0.5)
	      x = -x;
	    al = (x * x - 3) / 6;
	    h = 2 / (1 / (2 * a - 1)  + 1 / (2 * b - 1));
	    w = (x * Math.sqrt(al + h) / h) - (1 / (2 * b - 1) - 1 / (2 * a - 1)) *
	        (al + 5 / 6 - 2 / (3 * h));
	    x = a / (a + b * Math.exp(2 * w));
	  } else {
	    lna = Math.log(a / (a + b));
	    lnb = Math.log(b / (a + b));
	    t = Math.exp(a * lna) / a;
	    u = Math.exp(b * lnb) / b;
	    w = t + u;
	    if (p < t / w)
	      x = Math.pow(a * w * p, 1 / a);
	    else
	      x = 1 - Math.pow(b * w * (1 - p), 1 / b);
	  }
	  afac = -jStat.gammaln(a) - jStat.gammaln(b) + jStat.gammaln(a + b);
	  for(; j < 10; j++) {
	    if (x === 0 || x === 1)
	      return x;
	    err = jStat.ibeta(x, a, b) - p;
	    t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac);
	    u = err / t;
	    x -= (t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x)))));
	    if (x <= 0)
	      x = 0.5 * (x + t);
	    if (x >= 1)
	      x = 0.5 * (x + t + 1);
	    if (Math.abs(t) < EPS * x && j > 0)
	      break;
	  }
	  return x;
	};


	// Returns the incomplete beta function I_x(a,b)
	jStat.ibeta = function ibeta(x, a, b) {
	  // Factors in front of the continued fraction.
	  var bt = (x === 0 || x === 1) ?  0 :
	    Math.exp(jStat.gammaln(a + b) - jStat.gammaln(a) -
	             jStat.gammaln(b) + a * Math.log(x) + b *
	             Math.log(1 - x));
	  if (x < 0 || x > 1)
	    return false;
	  if (x < (a + 1) / (a + b + 2))
	    // Use continued fraction directly.
	    return bt * jStat.betacf(x, a, b) / a;
	  // else use continued fraction after making the symmetry transformation.
	  return 1 - bt * jStat.betacf(1 - x, b, a) / b;
	};


	// Returns a normal deviate (mu=0, sigma=1).
	// If n and m are specified it returns a object of normal deviates.
	jStat.randn = function randn(n, m) {
	  var u, v, x, y, q, mat;
	  if (!m)
	    m = n;
	  if (n)
	    return jStat.create(n, m, function() { return jStat.randn(); });
	  do {
	    u = Math.random();
	    v = 1.7156 * (Math.random() - 0.5);
	    x = u - 0.449871;
	    y = Math.abs(v) + 0.386595;
	    q = x * x + y * (0.19600 * y - 0.25472 * x);
	  } while (q > 0.27597 && (q > 0.27846 || v * v > -4 * Math.log(u) * u * u));
	  return v / u;
	};


	// Returns a gamma deviate by the method of Marsaglia and Tsang.
	jStat.randg = function randg(shape, n, m) {
	  var oalph = shape;
	  var a1, a2, u, v, x, mat;
	  if (!m)
	    m = n;
	  if (!shape)
	    shape = 1;
	  if (n) {
	    mat = jStat.zeros(n,m);
	    mat.alter(function() { return jStat.randg(shape); });
	    return mat;
	  }
	  if (shape < 1)
	    shape += 1;
	  a1 = shape - 1 / 3;
	  a2 = 1 / Math.sqrt(9 * a1);
	  do {
	    do {
	      x = jStat.randn();
	      v = 1 + a2 * x;
	    } while(v <= 0);
	    v = v * v * v;
	    u = Math.random();
	  } while(u > 1 - 0.331 * Math.pow(x, 4) &&
	          Math.log(u) > 0.5 * x*x + a1 * (1 - v + Math.log(v)));
	  // alpha > 1
	  if (shape == oalph)
	    return a1 * v;
	  // alpha < 1
	  do {
	    u = Math.random();
	  } while(u === 0);
	  return Math.pow(u, 1 / oalph) * a1 * v;
	};


	// making use of static methods on the instance
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jStat.fn[passfunc] = function() {
	      return jStat(
	          jStat.map(this, function(value) { return jStat[passfunc](value); }));
	    }
	  })(funcs[i]);
	})('gammaln gammafn factorial factorialln'.split(' '));


	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jStat.fn[passfunc] = function() {
	      return jStat(jStat[passfunc].apply(null, arguments));
	    };
	  })(funcs[i]);
	})('randn'.split(' '));

	}(jStat, Math));
	(function(jStat, Math) {

	// generate all distribution instance methods
	(function(list) {
	  for (var i = 0; i < list.length; i++) (function(func) {
	    // distribution instance method
	    jStat[func] = function(a, b, c) {
	      if (!(this instanceof arguments.callee))
	        return new arguments.callee(a, b, c);
	      this._a = a;
	      this._b = b;
	      this._c = c;
	      return this;
	    };
	    // distribution method to be used on a jStat instance
	    jStat.fn[func] = function(a, b, c) {
	      var newthis = jStat[func](a, b, c);
	      newthis.data = this;
	      return newthis;
	    };
	    // sample instance method
	    jStat[func].prototype.sample = function(arr) {
	      var a = this._a;
	      var b = this._b;
	      var c = this._c;
	      if (arr)
	        return jStat.alter(arr, function() {
	          return jStat[func].sample(a, b, c);
	        });
	      else
	        return jStat[func].sample(a, b, c);
	    };
	    // generate the pdf, cdf and inv instance methods
	    (function(vals) {
	      for (var i = 0; i < vals.length; i++) (function(fnfunc) {
	        jStat[func].prototype[fnfunc] = function(x) {
	          var a = this._a;
	          var b = this._b;
	          var c = this._c;
	          if (!x && x !== 0)
	            x = this.data;
	          if (typeof x !== 'number') {
	            return jStat.fn.map.call(x, function(x) {
	              return jStat[func][fnfunc](x, a, b, c);
	            });
	          }
	          return jStat[func][fnfunc](x, a, b, c);
	        };
	      })(vals[i]);
	    })('pdf cdf inv'.split(' '));
	    // generate the mean, median, mode and variance instance methods
	    (function(vals) {
	      for (var i = 0; i < vals.length; i++) (function(fnfunc) {
	        jStat[func].prototype[fnfunc] = function() {
	          return jStat[func][fnfunc](this._a, this._b, this._c);
	        };
	      })(vals[i]);
	    })('mean median mode variance'.split(' '));
	  })(list[i]);
	})((
	  'beta centralF cauchy chisquare exponential gamma invgamma kumaraswamy ' +
	  'laplace lognormal noncentralt normal pareto studentt weibull uniform ' +
	  'binomial negbin hypgeom poisson triangular tukey arcsine'
	).split(' '));



	// extend beta function with static methods
	jStat.extend(jStat.beta, {
	  pdf: function pdf(x, alpha, beta) {
	    // PDF is zero outside the support
	    if (x > 1 || x < 0)
	      return 0;
	    // PDF is one for the uniform case
	    if (alpha == 1 && beta == 1)
	      return 1;

	    if (alpha < 512 && beta < 512) {
	      return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) /
	          jStat.betafn(alpha, beta);
	    } else {
	      return Math.exp((alpha - 1) * Math.log(x) +
	                      (beta - 1) * Math.log(1 - x) -
	                      jStat.betaln(alpha, beta));
	    }
	  },

	  cdf: function cdf(x, alpha, beta) {
	    return (x > 1 || x < 0) ? (x > 1) * 1 : jStat.ibeta(x, alpha, beta);
	  },

	  inv: function inv(x, alpha, beta) {
	    return jStat.ibetainv(x, alpha, beta);
	  },

	  mean: function mean(alpha, beta) {
	    return alpha / (alpha + beta);
	  },

	  median: function median(alpha, beta) {
	    return jStat.ibetainv(0.5, alpha, beta);
	  },

	  mode: function mode(alpha, beta) {
	    return (alpha - 1 ) / ( alpha + beta - 2);
	  },

	  // return a random sample
	  sample: function sample(alpha, beta) {
	    var u = jStat.randg(alpha);
	    return u / (u + jStat.randg(beta));
	  },

	  variance: function variance(alpha, beta) {
	    return (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
	  }
	});

	// extend F function with static methods
	jStat.extend(jStat.centralF, {
	  // This implementation of the pdf function avoids float overflow
	  // See the way that R calculates this value:
	  // https://svn.r-project.org/R/trunk/src/nmath/df.c
	  pdf: function pdf(x, df1, df2) {
	    var p, q, f;

	    if (x < 0)
	      return 0;

	    if (df1 <= 2) {
	      if (x === 0 && df1 < 2) {
	        return Infinity;
	      }
	      if (x === 0 && df1 === 2) {
	        return 1;
	      }
	      return (1 / jStat.betafn(df1 / 2, df2 / 2)) *
	              Math.pow(df1 / df2, df1 / 2) *
	              Math.pow(x, (df1/2) - 1) *
	              Math.pow((1 + (df1 / df2) * x), -(df1 + df2) / 2);
	    }

	    p = (df1 * x) / (df2 + x * df1);
	    q = df2 / (df2 + x * df1);
	    f = df1 * q / 2.0;
	    return f * jStat.binomial.pdf((df1 - 2) / 2, (df1 + df2 - 2) / 2, p);
	  },

	  cdf: function cdf(x, df1, df2) {
	    if (x < 0)
	      return 0;
	    return jStat.ibeta((df1 * x) / (df1 * x + df2), df1 / 2, df2 / 2);
	  },

	  inv: function inv(x, df1, df2) {
	    return df2 / (df1 * (1 / jStat.ibetainv(x, df1 / 2, df2 / 2) - 1));
	  },

	  mean: function mean(df1, df2) {
	    return (df2 > 2) ? df2 / (df2 - 2) : undefined;
	  },

	  mode: function mode(df1, df2) {
	    return (df1 > 2) ? (df2 * (df1 - 2)) / (df1 * (df2 + 2)) : undefined;
	  },

	  // return a random sample
	  sample: function sample(df1, df2) {
	    var x1 = jStat.randg(df1 / 2) * 2;
	    var x2 = jStat.randg(df2 / 2) * 2;
	    return (x1 / df1) / (x2 / df2);
	  },

	  variance: function variance(df1, df2) {
	    if (df2 <= 4)
	      return undefined;
	    return 2 * df2 * df2 * (df1 + df2 - 2) /
	        (df1 * (df2 - 2) * (df2 - 2) * (df2 - 4));
	  }
	});


	// extend cauchy function with static methods
	jStat.extend(jStat.cauchy, {
	  pdf: function pdf(x, local, scale) {
	    if (scale < 0) { return 0; }

	    return (scale / (Math.pow(x - local, 2) + Math.pow(scale, 2))) / Math.PI;
	  },

	  cdf: function cdf(x, local, scale) {
	    return Math.atan((x - local) / scale) / Math.PI + 0.5;
	  },

	  inv: function(p, local, scale) {
	    return local + scale * Math.tan(Math.PI * (p - 0.5));
	  },

	  median: function median(local, scale) {
	    return local;
	  },

	  mode: function mode(local, scale) {
	    return local;
	  },

	  sample: function sample(local, scale) {
	    return jStat.randn() *
	        Math.sqrt(1 / (2 * jStat.randg(0.5))) * scale + local;
	  }
	});



	// extend chisquare function with static methods
	jStat.extend(jStat.chisquare, {
	  pdf: function pdf(x, dof) {
	    if (x < 0)
	      return 0;
	    return (x === 0 && dof === 2) ? 0.5 :
	        Math.exp((dof / 2 - 1) * Math.log(x) - x / 2 - (dof / 2) *
	                 Math.log(2) - jStat.gammaln(dof / 2));
	  },

	  cdf: function cdf(x, dof) {
	    if (x < 0)
	      return 0;
	    return jStat.lowRegGamma(dof / 2, x / 2);
	  },

	  inv: function(p, dof) {
	    return 2 * jStat.gammapinv(p, 0.5 * dof);
	  },

	  mean : function(dof) {
	    return dof;
	  },

	  // TODO: this is an approximation (is there a better way?)
	  median: function median(dof) {
	    return dof * Math.pow(1 - (2 / (9 * dof)), 3);
	  },

	  mode: function mode(dof) {
	    return (dof - 2 > 0) ? dof - 2 : 0;
	  },

	  sample: function sample(dof) {
	    return jStat.randg(dof / 2) * 2;
	  },

	  variance: function variance(dof) {
	    return 2 * dof;
	  }
	});



	// extend exponential function with static methods
	jStat.extend(jStat.exponential, {
	  pdf: function pdf(x, rate) {
	    return x < 0 ? 0 : rate * Math.exp(-rate * x);
	  },

	  cdf: function cdf(x, rate) {
	    return x < 0 ? 0 : 1 - Math.exp(-rate * x);
	  },

	  inv: function(p, rate) {
	    return -Math.log(1 - p) / rate;
	  },

	  mean : function(rate) {
	    return 1 / rate;
	  },

	  median: function (rate) {
	    return (1 / rate) * Math.log(2);
	  },

	  mode: function mode(rate) {
	    return 0;
	  },

	  sample: function sample(rate) {
	    return -1 / rate * Math.log(Math.random());
	  },

	  variance : function(rate) {
	    return Math.pow(rate, -2);
	  }
	});



	// extend gamma function with static methods
	jStat.extend(jStat.gamma, {
	  pdf: function pdf(x, shape, scale) {
	    if (x < 0)
	      return 0;
	    return (x === 0 && shape === 1) ? 1 / scale :
	            Math.exp((shape - 1) * Math.log(x) - x / scale -
	                    jStat.gammaln(shape) - shape * Math.log(scale));
	  },

	  cdf: function cdf(x, shape, scale) {
	    if (x < 0)
	      return 0;
	    return jStat.lowRegGamma(shape, x / scale);
	  },

	  inv: function(p, shape, scale) {
	    return jStat.gammapinv(p, shape) * scale;
	  },

	  mean : function(shape, scale) {
	    return shape * scale;
	  },

	  mode: function mode(shape, scale) {
	    if(shape > 1) return (shape - 1) * scale;
	    return undefined;
	  },

	  sample: function sample(shape, scale) {
	    return jStat.randg(shape) * scale;
	  },

	  variance: function variance(shape, scale) {
	    return shape * scale * scale;
	  }
	});

	// extend inverse gamma function with static methods
	jStat.extend(jStat.invgamma, {
	  pdf: function pdf(x, shape, scale) {
	    if (x <= 0)
	      return 0;
	    return Math.exp(-(shape + 1) * Math.log(x) - scale / x -
	                    jStat.gammaln(shape) + shape * Math.log(scale));
	  },

	  cdf: function cdf(x, shape, scale) {
	    if (x <= 0)
	      return 0;
	    return 1 - jStat.lowRegGamma(shape, scale / x);
	  },

	  inv: function(p, shape, scale) {
	    return scale / jStat.gammapinv(1 - p, shape);
	  },

	  mean : function(shape, scale) {
	    return (shape > 1) ? scale / (shape - 1) : undefined;
	  },

	  mode: function mode(shape, scale) {
	    return scale / (shape + 1);
	  },

	  sample: function sample(shape, scale) {
	    return scale / jStat.randg(shape);
	  },

	  variance: function variance(shape, scale) {
	    if (shape <= 2)
	      return undefined;
	    return scale * scale / ((shape - 1) * (shape - 1) * (shape - 2));
	  }
	});


	// extend kumaraswamy function with static methods
	jStat.extend(jStat.kumaraswamy, {
	  pdf: function pdf(x, alpha, beta) {
	    if (x === 0 && alpha === 1)
	      return beta;
	    else if (x === 1 && beta === 1)
	      return alpha;
	    return Math.exp(Math.log(alpha) + Math.log(beta) + (alpha - 1) *
	                    Math.log(x) + (beta - 1) *
	                    Math.log(1 - Math.pow(x, alpha)));
	  },

	  cdf: function cdf(x, alpha, beta) {
	    if (x < 0)
	      return 0;
	    else if (x > 1)
	      return 1;
	    return (1 - Math.pow(1 - Math.pow(x, alpha), beta));
	  },

	  inv: function inv(p, alpha, beta) {
	    return Math.pow(1 - Math.pow(1 - p, 1 / beta), 1 / alpha);
	  },

	  mean : function(alpha, beta) {
	    return (beta * jStat.gammafn(1 + 1 / alpha) *
	            jStat.gammafn(beta)) / (jStat.gammafn(1 + 1 / alpha + beta));
	  },

	  median: function median(alpha, beta) {
	    return Math.pow(1 - Math.pow(2, -1 / beta), 1 / alpha);
	  },

	  mode: function mode(alpha, beta) {
	    if (!(alpha >= 1 && beta >= 1 && (alpha !== 1 && beta !== 1)))
	      return undefined;
	    return Math.pow((alpha - 1) / (alpha * beta - 1), 1 / alpha);
	  },

	  variance: function variance(alpha, beta) {
	    throw new Error('variance not yet implemented');
	    // TODO: complete this
	  }
	});



	// extend lognormal function with static methods
	jStat.extend(jStat.lognormal, {
	  pdf: function pdf(x, mu, sigma) {
	    if (x <= 0)
	      return 0;
	    return Math.exp(-Math.log(x) - 0.5 * Math.log(2 * Math.PI) -
	                    Math.log(sigma) - Math.pow(Math.log(x) - mu, 2) /
	                    (2 * sigma * sigma));
	  },

	  cdf: function cdf(x, mu, sigma) {
	    if (x < 0)
	      return 0;
	    return 0.5 +
	        (0.5 * jStat.erf((Math.log(x) - mu) / Math.sqrt(2 * sigma * sigma)));
	  },

	  inv: function(p, mu, sigma) {
	    return Math.exp(-1.41421356237309505 * sigma * jStat.erfcinv(2 * p) + mu);
	  },

	  mean: function mean(mu, sigma) {
	    return Math.exp(mu + sigma * sigma / 2);
	  },

	  median: function median(mu, sigma) {
	    return Math.exp(mu);
	  },

	  mode: function mode(mu, sigma) {
	    return Math.exp(mu - sigma * sigma);
	  },

	  sample: function sample(mu, sigma) {
	    return Math.exp(jStat.randn() * sigma + mu);
	  },

	  variance: function variance(mu, sigma) {
	    return (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma);
	  }
	});



	// extend noncentralt function with static methods
	jStat.extend(jStat.noncentralt, {
	  pdf: function pdf(x, dof, ncp) {
	    var tol = 1e-14;
	    if (Math.abs(ncp) < tol)  // ncp approx 0; use student-t
	      return jStat.studentt.pdf(x, dof)

	    if (Math.abs(x) < tol) {  // different formula for x == 0
	      return Math.exp(jStat.gammaln((dof + 1) / 2) - ncp * ncp / 2 -
	                      0.5 * Math.log(Math.PI * dof) - jStat.gammaln(dof / 2));
	    }

	    // formula for x != 0
	    return dof / x *
	        (jStat.noncentralt.cdf(x * Math.sqrt(1 + 2 / dof), dof+2, ncp) -
	         jStat.noncentralt.cdf(x, dof, ncp));
	  },

	  cdf: function cdf(x, dof, ncp) {
	    var tol = 1e-14;
	    var min_iterations = 200;

	    if (Math.abs(ncp) < tol)  // ncp approx 0; use student-t
	      return jStat.studentt.cdf(x, dof);

	    // turn negative x into positive and flip result afterwards
	    var flip = false;
	    if (x < 0) {
	      flip = true;
	      ncp = -ncp;
	    }

	    var prob = jStat.normal.cdf(-ncp, 0, 1);
	    var value = tol + 1;
	    // use value at last two steps to determine convergence
	    var lastvalue = value;
	    var y = x * x / (x * x + dof);
	    var j = 0;
	    var p = Math.exp(-ncp * ncp / 2);
	    var q = Math.exp(-ncp * ncp / 2 - 0.5 * Math.log(2) -
	                     jStat.gammaln(3 / 2)) * ncp;
	    while (j < min_iterations || lastvalue > tol || value > tol) {
	      lastvalue = value;
	      if (j > 0) {
	        p *= (ncp * ncp) / (2 * j);
	        q *= (ncp * ncp) / (2 * (j + 1 / 2));
	      }
	      value = p * jStat.beta.cdf(y, j + 0.5, dof / 2) +
	          q * jStat.beta.cdf(y, j+1, dof/2);
	      prob += 0.5 * value;
	      j++;
	    }

	    return flip ? (1 - prob) : prob;
	  }
	});


	// extend normal function with static methods
	jStat.extend(jStat.normal, {
	  pdf: function pdf(x, mean, std) {
	    return Math.exp(-0.5 * Math.log(2 * Math.PI) -
	                    Math.log(std) - Math.pow(x - mean, 2) / (2 * std * std));
	  },

	  cdf: function cdf(x, mean, std) {
	    return 0.5 * (1 + jStat.erf((x - mean) / Math.sqrt(2 * std * std)));
	  },

	  inv: function(p, mean, std) {
	    return -1.41421356237309505 * std * jStat.erfcinv(2 * p) + mean;
	  },

	  mean : function(mean, std) {
	    return mean;
	  },

	  median: function median(mean, std) {
	    return mean;
	  },

	  mode: function (mean, std) {
	    return mean;
	  },

	  sample: function sample(mean, std) {
	    return jStat.randn() * std + mean;
	  },

	  variance : function(mean, std) {
	    return std * std;
	  }
	});



	// extend pareto function with static methods
	jStat.extend(jStat.pareto, {
	  pdf: function pdf(x, scale, shape) {
	    if (x < scale)
	      return 0;
	    return (shape * Math.pow(scale, shape)) / Math.pow(x, shape + 1);
	  },

	  cdf: function cdf(x, scale, shape) {
	    if (x < scale)
	      return 0;
	    return 1 - Math.pow(scale / x, shape);
	  },

	  inv: function inv(p, scale, shape) {
	    return scale / Math.pow(1 - p, 1 / shape);
	  },

	  mean: function mean(scale, shape) {
	    if (shape <= 1)
	      return undefined;
	    return (shape * Math.pow(scale, shape)) / (shape - 1);
	  },

	  median: function median(scale, shape) {
	    return scale * (shape * Math.SQRT2);
	  },

	  mode: function mode(scale, shape) {
	    return scale;
	  },

	  variance : function(scale, shape) {
	    if (shape <= 2)
	      return undefined;
	    return (scale*scale * shape) / (Math.pow(shape - 1, 2) * (shape - 2));
	  }
	});



	// extend studentt function with static methods
	jStat.extend(jStat.studentt, {
	  pdf: function pdf(x, dof) {
	    dof = dof > 1e100 ? 1e100 : dof;
	    return (1/(Math.sqrt(dof) * jStat.betafn(0.5, dof/2))) *
	        Math.pow(1 + ((x * x) / dof), -((dof + 1) / 2));
	  },

	  cdf: function cdf(x, dof) {
	    var dof2 = dof / 2;
	    return jStat.ibeta((x + Math.sqrt(x * x + dof)) /
	                       (2 * Math.sqrt(x * x + dof)), dof2, dof2);
	  },

	  inv: function(p, dof) {
	    var x = jStat.ibetainv(2 * Math.min(p, 1 - p), 0.5 * dof, 0.5);
	    x = Math.sqrt(dof * (1 - x) / x);
	    return (p > 0.5) ? x : -x;
	  },

	  mean: function mean(dof) {
	    return (dof > 1) ? 0 : undefined;
	  },

	  median: function median(dof) {
	    return 0;
	  },

	  mode: function mode(dof) {
	    return 0;
	  },

	  sample: function sample(dof) {
	    return jStat.randn() * Math.sqrt(dof / (2 * jStat.randg(dof / 2)));
	  },

	  variance: function variance(dof) {
	    return (dof  > 2) ? dof / (dof - 2) : (dof > 1) ? Infinity : undefined;
	  }
	});



	// extend weibull function with static methods
	jStat.extend(jStat.weibull, {
	  pdf: function pdf(x, scale, shape) {
	    if (x < 0 || scale < 0 || shape < 0)
	      return 0;
	    return (shape / scale) * Math.pow((x / scale), (shape - 1)) *
	        Math.exp(-(Math.pow((x / scale), shape)));
	  },

	  cdf: function cdf(x, scale, shape) {
	    return x < 0 ? 0 : 1 - Math.exp(-Math.pow((x / scale), shape));
	  },

	  inv: function(p, scale, shape) {
	    return scale * Math.pow(-Math.log(1 - p), 1 / shape);
	  },

	  mean : function(scale, shape) {
	    return scale * jStat.gammafn(1 + 1 / shape);
	  },

	  median: function median(scale, shape) {
	    return scale * Math.pow(Math.log(2), 1 / shape);
	  },

	  mode: function mode(scale, shape) {
	    if (shape <= 1)
	      return 0;
	    return scale * Math.pow((shape - 1) / shape, 1 / shape);
	  },

	  sample: function sample(scale, shape) {
	    return scale * Math.pow(-Math.log(Math.random()), 1 / shape);
	  },

	  variance: function variance(scale, shape) {
	    return scale * scale * jStat.gammafn(1 + 2 / shape) -
	        Math.pow(jStat.weibull.mean(scale, shape), 2);
	  }
	});



	// extend uniform function with static methods
	jStat.extend(jStat.uniform, {
	  pdf: function pdf(x, a, b) {
	    return (x < a || x > b) ? 0 : 1 / (b - a);
	  },

	  cdf: function cdf(x, a, b) {
	    if (x < a)
	      return 0;
	    else if (x < b)
	      return (x - a) / (b - a);
	    return 1;
	  },

	  inv: function(p, a, b) {
	    return a + (p * (b - a));
	  },

	  mean: function mean(a, b) {
	    return 0.5 * (a + b);
	  },

	  median: function median(a, b) {
	    return jStat.mean(a, b);
	  },

	  mode: function mode(a, b) {
	    throw new Error('mode is not yet implemented');
	  },

	  sample: function sample(a, b) {
	    return (a / 2 + b / 2) + (b / 2 - a / 2) * (2 * Math.random() - 1);
	  },

	  variance: function variance(a, b) {
	    return Math.pow(b - a, 2) / 12;
	  }
	});



	// extend uniform function with static methods
	jStat.extend(jStat.binomial, {
	  pdf: function pdf(k, n, p) {
	    return (p === 0 || p === 1) ?
	      ((n * p) === k ? 1 : 0) :
	      jStat.combination(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
	  },

	  cdf: function cdf(x, n, p) {
	    var binomarr = [],
	    k = 0;
	    if (x < 0) {
	      return 0;
	    }
	    if (x < n) {
	      for (; k <= x; k++) {
	        binomarr[ k ] = jStat.binomial.pdf(k, n, p);
	      }
	      return jStat.sum(binomarr);
	    }
	    return 1;
	  }
	});



	// extend uniform function with static methods
	jStat.extend(jStat.negbin, {
	  pdf: function pdf(k, r, p) {
	    if (k !== k >>> 0)
	      return false;
	    if (k < 0)
	      return 0;
	    return jStat.combination(k + r - 1, r - 1) *
	        Math.pow(1 - p, k) * Math.pow(p, r);
	  },

	  cdf: function cdf(x, r, p) {
	    var sum = 0,
	    k = 0;
	    if (x < 0) return 0;
	    for (; k <= x; k++) {
	      sum += jStat.negbin.pdf(k, r, p);
	    }
	    return sum;
	  }
	});



	// extend uniform function with static methods
	jStat.extend(jStat.hypgeom, {
	  pdf: function pdf(k, N, m, n) {
	    // Hypergeometric PDF.

	    // A simplification of the CDF algorithm below.

	    // k = number of successes drawn
	    // N = population size
	    // m = number of successes in population
	    // n = number of items drawn from population

	    if(k !== k | 0) {
	      return false;
	    } else if(k < 0 || k < m - (N - n)) {
	      // It's impossible to have this few successes drawn.
	      return 0;
	    } else if(k > n || k > m) {
	      // It's impossible to have this many successes drawn.
	      return 0;
	    } else if (m * 2 > N) {
	      // More than half the population is successes.

	      if(n * 2 > N) {
	        // More than half the population is sampled.

	        return jStat.hypgeom.pdf(N - m - n + k, N, N - m, N - n)
	      } else {
	        // Half or less of the population is sampled.

	        return jStat.hypgeom.pdf(n - k, N, N - m, n);
	      }

	    } else if(n * 2 > N) {
	      // Half or less is successes.

	      return jStat.hypgeom.pdf(m - k, N, m, N - n);

	    } else if(m < n) {
	      // We want to have the number of things sampled to be less than the
	      // successes available. So swap the definitions of successful and sampled.
	      return jStat.hypgeom.pdf(k, N, n, m);
	    } else {
	      // If we get here, half or less of the population was sampled, half or
	      // less of it was successes, and we had fewer sampled things than
	      // successes. Now we can do this complicated iterative algorithm in an
	      // efficient way.

	      // The basic premise of the algorithm is that we partially normalize our
	      // intermediate product to keep it in a numerically good region, and then
	      // finish the normalization at the end.

	      // This variable holds the scaled probability of the current number of
	      // successes.
	      var scaledPDF = 1;

	      // This keeps track of how much we have normalized.
	      var samplesDone = 0;

	      for(var i = 0; i < k; i++) {
	        // For every possible number of successes up to that observed...

	        while(scaledPDF > 1 && samplesDone < n) {
	          // Intermediate result is growing too big. Apply some of the
	          // normalization to shrink everything.

	          scaledPDF *= 1 - (m / (N - samplesDone));

	          // Say we've normalized by this sample already.
	          samplesDone++;
	        }

	        // Work out the partially-normalized hypergeometric PDF for the next
	        // number of successes
	        scaledPDF *= (n - i) * (m - i) / ((i + 1) * (N - m - n + i + 1));
	      }

	      for(; samplesDone < n; samplesDone++) {
	        // Apply all the rest of the normalization
	        scaledPDF *= 1 - (m / (N - samplesDone));
	      }

	      // Bound answer sanely before returning.
	      return Math.min(1, Math.max(0, scaledPDF));
	    }
	  },

	  cdf: function cdf(x, N, m, n) {
	    // Hypergeometric CDF.

	    // This algorithm is due to Prof. Thomas S. Ferguson, <tom@math.ucla.edu>,
	    // and comes from his hypergeometric test calculator at
	    // <http://www.math.ucla.edu/~tom/distributions/Hypergeometric.html>.

	    // x = number of successes drawn
	    // N = population size
	    // m = number of successes in population
	    // n = number of items drawn from population

	    if(x < 0 || x < m - (N - n)) {
	      // It's impossible to have this few successes drawn or fewer.
	      return 0;
	    } else if(x >= n || x >= m) {
	      // We will always have this many successes or fewer.
	      return 1;
	    } else if (m * 2 > N) {
	      // More than half the population is successes.

	      if(n * 2 > N) {
	        // More than half the population is sampled.

	        return jStat.hypgeom.cdf(N - m - n + x, N, N - m, N - n)
	      } else {
	        // Half or less of the population is sampled.

	        return 1 - jStat.hypgeom.cdf(n - x - 1, N, N - m, n);
	      }

	    } else if(n * 2 > N) {
	      // Half or less is successes.

	      return 1 - jStat.hypgeom.cdf(m - x - 1, N, m, N - n);

	    } else if(m < n) {
	      // We want to have the number of things sampled to be less than the
	      // successes available. So swap the definitions of successful and sampled.
	      return jStat.hypgeom.cdf(x, N, n, m);
	    } else {
	      // If we get here, half or less of the population was sampled, half or
	      // less of it was successes, and we had fewer sampled things than
	      // successes. Now we can do this complicated iterative algorithm in an
	      // efficient way.

	      // The basic premise of the algorithm is that we partially normalize our
	      // intermediate sum to keep it in a numerically good region, and then
	      // finish the normalization at the end.

	      // Holds the intermediate, scaled total CDF.
	      var scaledCDF = 1;

	      // This variable holds the scaled probability of the current number of
	      // successes.
	      var scaledPDF = 1;

	      // This keeps track of how much we have normalized.
	      var samplesDone = 0;

	      for(var i = 0; i < x; i++) {
	        // For every possible number of successes up to that observed...

	        while(scaledCDF > 1 && samplesDone < n) {
	          // Intermediate result is growing too big. Apply some of the
	          // normalization to shrink everything.

	          var factor = 1 - (m / (N - samplesDone));

	          scaledPDF *= factor;
	          scaledCDF *= factor;

	          // Say we've normalized by this sample already.
	          samplesDone++;
	        }

	        // Work out the partially-normalized hypergeometric PDF for the next
	        // number of successes
	        scaledPDF *= (n - i) * (m - i) / ((i + 1) * (N - m - n + i + 1));

	        // Add to the CDF answer.
	        scaledCDF += scaledPDF;
	      }

	      for(; samplesDone < n; samplesDone++) {
	        // Apply all the rest of the normalization
	        scaledCDF *= 1 - (m / (N - samplesDone));
	      }

	      // Bound answer sanely before returning.
	      return Math.min(1, Math.max(0, scaledCDF));
	    }
	  }
	});



	// extend uniform function with static methods
	jStat.extend(jStat.poisson, {
	  pdf: function pdf(k, l) {
	    if (l < 0 || (k % 1) !== 0 || k < 0) {
	      return 0;
	    }

	    return Math.pow(l, k) * Math.exp(-l) / jStat.factorial(k);
	  },

	  cdf: function cdf(x, l) {
	    var sumarr = [],
	    k = 0;
	    if (x < 0) return 0;
	    for (; k <= x; k++) {
	      sumarr.push(jStat.poisson.pdf(k, l));
	    }
	    return jStat.sum(sumarr);
	  },

	  mean : function(l) {
	    return l;
	  },

	  variance : function(l) {
	    return l;
	  },

	  sample: function sample(l) {
	    var p = 1, k = 0, L = Math.exp(-l);
	    do {
	      k++;
	      p *= Math.random();
	    } while (p > L);
	    return k - 1;
	  }
	});

	// extend triangular function with static methods
	jStat.extend(jStat.triangular, {
	  pdf: function pdf(x, a, b, c) {
	    if (b <= a || c < a || c > b) {
	      return NaN;
	    } else {
	      if (x < a || x > b) {
	        return 0;
	      } else if (x < c) {
	          return (2 * (x - a)) / ((b - a) * (c - a));
	      } else if (x === c) {
	          return (2 / (b - a));
	      } else { // x > c
	          return (2 * (b - x)) / ((b - a) * (b - c));
	      }
	    }
	  },

	  cdf: function cdf(x, a, b, c) {
	    if (b <= a || c < a || c > b)
	      return NaN;
	    if (x <= a)
	      return 0;
	    else if (x >= b)
	      return 1;
	    if (x <= c)
	      return Math.pow(x - a, 2) / ((b - a) * (c - a));
	    else // x > c
	      return 1 - Math.pow(b - x, 2) / ((b - a) * (b - c));
	  },

	  inv: function inv(p, a, b, c) {
	    if (b <= a || c < a || c > b) {
	      return NaN;
	    } else {
	      if (p <= ((c - a) / (b - a))) {
	        return a + (b - a) * Math.sqrt(p * ((c - a) / (b - a)));
	      } else { // p > ((c - a) / (b - a))
	        return a + (b - a) * (1 - Math.sqrt((1 - p) * (1 - ((c - a) / (b - a)))));
	      }
	    }
	  },

	  mean: function mean(a, b, c) {
	    return (a + b + c) / 3;
	  },

	  median: function median(a, b, c) {
	    if (c <= (a + b) / 2) {
	      return b - Math.sqrt((b - a) * (b - c)) / Math.sqrt(2);
	    } else if (c > (a + b) / 2) {
	      return a + Math.sqrt((b - a) * (c - a)) / Math.sqrt(2);
	    }
	  },

	  mode: function mode(a, b, c) {
	    return c;
	  },

	  sample: function sample(a, b, c) {
	    var u = Math.random();
	    if (u < ((c - a) / (b - a)))
	      return a + Math.sqrt(u * (b - a) * (c - a))
	    return b - Math.sqrt((1 - u) * (b - a) * (b - c));
	  },

	  variance: function variance(a, b, c) {
	    return (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
	  }
	});


	// extend arcsine function with static methods
	jStat.extend(jStat.arcsine, {
	  pdf: function pdf(x, a, b) {
	    if (b <= a) return NaN;

	    return (x <= a || x >= b) ? 0 :
	      (2 / Math.PI) *
	        Math.pow(Math.pow(b - a, 2) -
	                  Math.pow(2 * x - a - b, 2), -0.5);
	  },

	  cdf: function cdf(x, a, b) {
	    if (x < a)
	      return 0;
	    else if (x < b)
	      return (2 / Math.PI) * Math.asin(Math.sqrt((x - a)/(b - a)));
	    return 1;
	  },

	  inv: function(p, a, b) {
	    return a + (0.5 - 0.5 * Math.cos(Math.PI * p)) * (b - a);
	  },

	  mean: function mean(a, b) {
	    if (b <= a) return NaN;
	    return (a + b) / 2;
	  },

	  median: function median(a, b) {
	    if (b <= a) return NaN;
	    return (a + b) / 2;
	  },

	  mode: function mode(a, b) {
	    throw new Error('mode is not yet implemented');
	  },

	  sample: function sample(a, b) {
	    return ((a + b) / 2) + ((b - a) / 2) *
	      Math.sin(2 * Math.PI * jStat.uniform.sample(0, 1));
	  },

	  variance: function variance(a, b) {
	    if (b <= a) return NaN;
	    return Math.pow(b - a, 2) / 8;
	  }
	});


	function laplaceSign(x) { return x / Math.abs(x); }

	jStat.extend(jStat.laplace, {
	  pdf: function pdf(x, mu, b) {
	    return (b <= 0) ? 0 : (Math.exp(-Math.abs(x - mu) / b)) / (2 * b);
	  },

	  cdf: function cdf(x, mu, b) {
	    if (b <= 0) { return 0; }

	    if(x < mu) {
	      return 0.5 * Math.exp((x - mu) / b);
	    } else {
	      return 1 - 0.5 * Math.exp(- (x - mu) / b);
	    }
	  },

	  mean: function(mu, b) {
	    return mu;
	  },

	  median: function(mu, b) {
	    return mu;
	  },

	  mode: function(mu, b) {
	    return mu;
	  },

	  variance: function(mu, b) {
	    return 2 * b * b;
	  },

	  sample: function sample(mu, b) {
	    var u = Math.random() - 0.5;

	    return mu - (b * laplaceSign(u) * Math.log(1 - (2 * Math.abs(u))));
	  }
	});

	function tukeyWprob(w, rr, cc) {
	  var nleg = 12;
	  var ihalf = 6;

	  var C1 = -30;
	  var C2 = -50;
	  var C3 = 60;
	  var bb   = 8;
	  var wlar = 3;
	  var wincr1 = 2;
	  var wincr2 = 3;
	  var xleg = [
	    0.981560634246719250690549090149,
	    0.904117256370474856678465866119,
	    0.769902674194304687036893833213,
	    0.587317954286617447296702418941,
	    0.367831498998180193752691536644,
	    0.125233408511468915472441369464
	  ];
	  var aleg = [
	    0.047175336386511827194615961485,
	    0.106939325995318430960254718194,
	    0.160078328543346226334652529543,
	    0.203167426723065921749064455810,
	    0.233492536538354808760849898925,
	    0.249147045813402785000562436043
	  ];

	  var qsqz = w * 0.5;

	  // if w >= 16 then the integral lower bound (occurs for c=20)
	  // is 0.99999999999995 so return a value of 1.

	  if (qsqz >= bb)
	    return 1.0;

	  // find (f(w/2) - 1) ^ cc
	  // (first term in integral of hartley's form).

	  var pr_w = 2 * jStat.normal.cdf(qsqz, 0, 1, 1, 0) - 1; // erf(qsqz / M_SQRT2)
	  // if pr_w ^ cc < 2e-22 then set pr_w = 0
	  if (pr_w >= Math.exp(C2 / cc))
	    pr_w = Math.pow(pr_w, cc);
	  else
	    pr_w = 0.0;

	  // if w is large then the second component of the
	  // integral is small, so fewer intervals are needed.

	  var wincr;
	  if (w > wlar)
	    wincr = wincr1;
	  else
	    wincr = wincr2;

	  // find the integral of second term of hartley's form
	  // for the integral of the range for equal-length
	  // intervals using legendre quadrature.  limits of
	  // integration are from (w/2, 8).  two or three
	  // equal-length intervals are used.

	  // blb and bub are lower and upper limits of integration.

	  var blb = qsqz;
	  var binc = (bb - qsqz) / wincr;
	  var bub = blb + binc;
	  var einsum = 0.0;

	  // integrate over each interval

	  var cc1 = cc - 1.0;
	  for (var wi = 1; wi <= wincr; wi++) {
	    var elsum = 0.0;
	    var a = 0.5 * (bub + blb);

	    // legendre quadrature with order = nleg

	    var b = 0.5 * (bub - blb);

	    for (var jj = 1; jj <= nleg; jj++) {
	      var j, xx;
	      if (ihalf < jj) {
	        j = (nleg - jj) + 1;
	        xx = xleg[j-1];
	      } else {
	        j = jj;
	        xx = -xleg[j-1];
	      }
	      var c = b * xx;
	      var ac = a + c;

	      // if exp(-qexpo/2) < 9e-14,
	      // then doesn't contribute to integral

	      var qexpo = ac * ac;
	      if (qexpo > C3)
	        break;

	      var pplus = 2 * jStat.normal.cdf(ac, 0, 1, 1, 0);
	      var pminus= 2 * jStat.normal.cdf(ac, w, 1, 1, 0);

	      // if rinsum ^ (cc-1) < 9e-14,
	      // then doesn't contribute to integral

	      var rinsum = (pplus * 0.5) - (pminus * 0.5);
	      if (rinsum >= Math.exp(C1 / cc1)) {
	        rinsum = (aleg[j-1] * Math.exp(-(0.5 * qexpo))) * Math.pow(rinsum, cc1);
	        elsum += rinsum;
	      }
	    }
	    elsum *= (((2.0 * b) * cc) / Math.sqrt(2 * Math.PI));
	    einsum += elsum;
	    blb = bub;
	    bub += binc;
	  }

	  // if pr_w ^ rr < 9e-14, then return 0
	  pr_w += einsum;
	  if (pr_w <= Math.exp(C1 / rr))
	    return 0;

	  pr_w = Math.pow(pr_w, rr);
	  if (pr_w >= 1) // 1 was iMax was eps
	    return 1;
	  return pr_w;
	}

	function tukeyQinv(p, c, v) {
	  var p0 = 0.322232421088;
	  var q0 = 0.993484626060e-01;
	  var p1 = -1.0;
	  var q1 = 0.588581570495;
	  var p2 = -0.342242088547;
	  var q2 = 0.531103462366;
	  var p3 = -0.204231210125;
	  var q3 = 0.103537752850;
	  var p4 = -0.453642210148e-04;
	  var q4 = 0.38560700634e-02;
	  var c1 = 0.8832;
	  var c2 = 0.2368;
	  var c3 = 1.214;
	  var c4 = 1.208;
	  var c5 = 1.4142;
	  var vmax = 120.0;

	  var ps = 0.5 - 0.5 * p;
	  var yi = Math.sqrt(Math.log(1.0 / (ps * ps)));
	  var t = yi + (((( yi * p4 + p3) * yi + p2) * yi + p1) * yi + p0)
	     / (((( yi * q4 + q3) * yi + q2) * yi + q1) * yi + q0);
	  if (v < vmax) t += (t * t * t + t) / v / 4.0;
	  var q = c1 - c2 * t;
	  if (v < vmax) q += -c3 / v + c4 * t / v;
	  return t * (q * Math.log(c - 1.0) + c5);
	}

	jStat.extend(jStat.tukey, {
	  cdf: function cdf(q, nmeans, df) {
	    // Identical implementation as the R ptukey() function as of commit 68947
	    var rr = 1;
	    var cc = nmeans;

	    var nlegq = 16;
	    var ihalfq = 8;

	    var eps1 = -30.0;
	    var eps2 = 1.0e-14;
	    var dhaf  = 100.0;
	    var dquar = 800.0;
	    var deigh = 5000.0;
	    var dlarg = 25000.0;
	    var ulen1 = 1.0;
	    var ulen2 = 0.5;
	    var ulen3 = 0.25;
	    var ulen4 = 0.125;
	    var xlegq = [
	      0.989400934991649932596154173450,
	      0.944575023073232576077988415535,
	      0.865631202387831743880467897712,
	      0.755404408355003033895101194847,
	      0.617876244402643748446671764049,
	      0.458016777657227386342419442984,
	      0.281603550779258913230460501460,
	      0.950125098376374401853193354250e-1
	    ];
	    var alegq = [
	      0.271524594117540948517805724560e-1,
	      0.622535239386478928628438369944e-1,
	      0.951585116824927848099251076022e-1,
	      0.124628971255533872052476282192,
	      0.149595988816576732081501730547,
	      0.169156519395002538189312079030,
	      0.182603415044923588866763667969,
	      0.189450610455068496285396723208
	    ];

	    if (q <= 0)
	      return 0;

	    // df must be > 1
	    // there must be at least two values

	    if (df < 2 || rr < 1 || cc < 2) return NaN;

	    if (!Number.isFinite(q))
	      return 1;

	    if (df > dlarg)
	      return tukeyWprob(q, rr, cc);

	    // calculate leading constant

	    var f2 = df * 0.5;
	    var f2lf = ((f2 * Math.log(df)) - (df * Math.log(2))) - jStat.gammaln(f2);
	    var f21 = f2 - 1.0;

	    // integral is divided into unit, half-unit, quarter-unit, or
	    // eighth-unit length intervals depending on the value of the
	    // degrees of freedom.

	    var ff4 = df * 0.25;
	    var ulen;
	    if      (df <= dhaf)  ulen = ulen1;
	    else if (df <= dquar) ulen = ulen2;
	    else if (df <= deigh) ulen = ulen3;
	    else                  ulen = ulen4;

	    f2lf += Math.log(ulen);

	    // integrate over each subinterval

	    var ans = 0.0;

	    for (var i = 1; i <= 50; i++) {
	      var otsum = 0.0;

	      // legendre quadrature with order = nlegq
	      // nodes (stored in xlegq) are symmetric around zero.

	      var twa1 = (2 * i - 1) * ulen;

	      for (var jj = 1; jj <= nlegq; jj++) {
	        var j, t1;
	        if (ihalfq < jj) {
	          j = jj - ihalfq - 1;
	          t1 = (f2lf + (f21 * Math.log(twa1 + (xlegq[j] * ulen))))
	              - (((xlegq[j] * ulen) + twa1) * ff4);
	        } else {
	          j = jj - 1;
	          t1 = (f2lf + (f21 * Math.log(twa1 - (xlegq[j] * ulen))))
	              + (((xlegq[j] * ulen) - twa1) * ff4);
	        }

	        // if exp(t1) < 9e-14, then doesn't contribute to integral
	        var qsqz;
	        if (t1 >= eps1) {
	          if (ihalfq < jj) {
	            qsqz = q * Math.sqrt(((xlegq[j] * ulen) + twa1) * 0.5);
	          } else {
	            qsqz = q * Math.sqrt(((-(xlegq[j] * ulen)) + twa1) * 0.5);
	          }

	          // call wprob to find integral of range portion

	          var wprb = tukeyWprob(qsqz, rr, cc);
	          var rotsum = (wprb * alegq[j]) * Math.exp(t1);
	          otsum += rotsum;
	        }
	        // end legendre integral for interval i
	        // L200:
	      }

	      // if integral for interval i < 1e-14, then stop.
	      // However, in order to avoid small area under left tail,
	      // at least  1 / ulen  intervals are calculated.
	      if (i * ulen >= 1.0 && otsum <= eps2)
	        break;

	      // end of interval i
	      // L330:

	      ans += otsum;
	    }

	    if (otsum > eps2) { // not converged
	      throw new Error('tukey.cdf failed to converge');
	    }
	    if (ans > 1)
	      ans = 1;
	    return ans;
	  },

	  inv: function(p, nmeans, df) {
	    // Identical implementation as the R qtukey() function as of commit 68947
	    var rr = 1;
	    var cc = nmeans;

	    var eps = 0.0001;
	    var maxiter = 50;

	    // df must be > 1 ; there must be at least two values
	    if (df < 2 || rr < 1 || cc < 2) return NaN;

	    if (p < 0 || p > 1) return NaN;
	    if (p === 0) return 0;
	    if (p === 1) return Infinity;

	    // Initial value

	    var x0 = tukeyQinv(p, cc, df);

	    // Find prob(value < x0)

	    var valx0 = jStat.tukey.cdf(x0, nmeans, df) - p;

	    // Find the second iterate and prob(value < x1).
	    // If the first iterate has probability value
	    // exceeding p then second iterate is 1 less than
	    // first iterate; otherwise it is 1 greater.

	    var x1;
	    if (valx0 > 0.0)
	      x1 = Math.max(0.0, x0 - 1.0);
	    else
	      x1 = x0 + 1.0;
	    var valx1 = jStat.tukey.cdf(x1, nmeans, df) - p;

	    // Find new iterate

	    var ans;
	    for(var iter = 1; iter < maxiter; iter++) {
	      ans = x1 - ((valx1 * (x1 - x0)) / (valx1 - valx0));
	      valx0 = valx1;

	      // New iterate must be >= 0

	      x0 = x1;
	      if (ans < 0.0) {
	        ans = 0.0;
	        valx1 = -p;
	      }
	      // Find prob(value < new iterate)

	      valx1 = jStat.tukey.cdf(ans, nmeans, df) - p;
	      x1 = ans;

	      // If the difference between two successive
	      // iterates is less than eps, stop

	      var xabs = Math.abs(x1 - x0);
	      if (xabs < eps)
	        return ans;
	    }

	    throw new Error('tukey.inv failed to converge');
	  }
	});

	}(jStat, Math));
	/* Provides functions for the solution of linear system of equations, integration, extrapolation,
	 * interpolation, eigenvalue problems, differential equations and PCA analysis. */

	(function(jStat, Math) {

	var push = Array.prototype.push;
	var isArray = jStat.utils.isArray;

	function isUsable(arg) {
	  return isArray(arg) || arg instanceof jStat;
	}

	jStat.extend({

	  // add a vector/matrix to a vector/matrix or scalar
	  add: function add(arr, arg) {
	    // check if arg is a vector or scalar
	    if (isUsable(arg)) {
	      if (!isUsable(arg[0])) arg = [ arg ];
	      return jStat.map(arr, function(value, row, col) {
	        return value + arg[row][col];
	      });
	    }
	    return jStat.map(arr, function(value) { return value + arg; });
	  },

	  // subtract a vector or scalar from the vector
	  subtract: function subtract(arr, arg) {
	    // check if arg is a vector or scalar
	    if (isUsable(arg)) {
	      if (!isUsable(arg[0])) arg = [ arg ];
	      return jStat.map(arr, function(value, row, col) {
	        return value - arg[row][col] || 0;
	      });
	    }
	    return jStat.map(arr, function(value) { return value - arg; });
	  },

	  // matrix division
	  divide: function divide(arr, arg) {
	    if (isUsable(arg)) {
	      if (!isUsable(arg[0])) arg = [ arg ];
	      return jStat.multiply(arr, jStat.inv(arg));
	    }
	    return jStat.map(arr, function(value) { return value / arg; });
	  },

	  // matrix multiplication
	  multiply: function multiply(arr, arg) {
	    var row, col, nrescols, sum, nrow, ncol, res, rescols;
	    // eg: arr = 2 arg = 3 -> 6 for res[0][0] statement closure
	    if (arr.length === undefined && arg.length === undefined) {
	      return arr * arg;
	    }
	    nrow = arr.length,
	    ncol = arr[0].length,
	    res = jStat.zeros(nrow, nrescols = (isUsable(arg)) ? arg[0].length : ncol),
	    rescols = 0;
	    if (isUsable(arg)) {
	      for (; rescols < nrescols; rescols++) {
	        for (row = 0; row < nrow; row++) {
	          sum = 0;
	          for (col = 0; col < ncol; col++)
	          sum += arr[row][col] * arg[col][rescols];
	          res[row][rescols] = sum;
	        }
	      }
	      return (nrow === 1 && rescols === 1) ? res[0][0] : res;
	    }
	    return jStat.map(arr, function(value) { return value * arg; });
	  },

	  // outer([1,2,3],[4,5,6])
	  // ===
	  // [[1],[2],[3]] times [[4,5,6]]
	  // ->
	  // [[4,5,6],[8,10,12],[12,15,18]]
	  outer:function outer(A, B) {
	    return jStat.multiply(A.map(function(t){ return [t] }), [B]);
	  },


	  // Returns the dot product of two matricies
	  dot: function dot(arr, arg) {
	    if (!isUsable(arr[0])) arr = [ arr ];
	    if (!isUsable(arg[0])) arg = [ arg ];
	    // convert column to row vector
	    var left = (arr[0].length === 1 && arr.length !== 1) ? jStat.transpose(arr) : arr,
	    right = (arg[0].length === 1 && arg.length !== 1) ? jStat.transpose(arg) : arg,
	    res = [],
	    row = 0,
	    nrow = left.length,
	    ncol = left[0].length,
	    sum, col;
	    for (; row < nrow; row++) {
	      res[row] = [];
	      sum = 0;
	      for (col = 0; col < ncol; col++)
	      sum += left[row][col] * right[row][col];
	      res[row] = sum;
	    }
	    return (res.length === 1) ? res[0] : res;
	  },

	  // raise every element by a scalar
	  pow: function pow(arr, arg) {
	    return jStat.map(arr, function(value) { return Math.pow(value, arg); });
	  },

	  // exponentiate every element
	  exp: function exp(arr) {
	    return jStat.map(arr, function(value) { return Math.exp(value); });
	  },

	  // generate the natural log of every element
	  log: function exp(arr) {
	    return jStat.map(arr, function(value) { return Math.log(value); });
	  },

	  // generate the absolute values of the vector
	  abs: function abs(arr) {
	    return jStat.map(arr, function(value) { return Math.abs(value); });
	  },

	  // computes the p-norm of the vector
	  // In the case that a matrix is passed, uses the first row as the vector
	  norm: function norm(arr, p) {
	    var nnorm = 0,
	    i = 0;
	    // check the p-value of the norm, and set for most common case
	    if (isNaN(p)) p = 2;
	    // check if multi-dimensional array, and make vector correction
	    if (isUsable(arr[0])) arr = arr[0];
	    // vector norm
	    for (; i < arr.length; i++) {
	      nnorm += Math.pow(Math.abs(arr[i]), p);
	    }
	    return Math.pow(nnorm, 1 / p);
	  },

	  // computes the angle between two vectors in rads
	  // In case a matrix is passed, this uses the first row as the vector
	  angle: function angle(arr, arg) {
	    return Math.acos(jStat.dot(arr, arg) / (jStat.norm(arr) * jStat.norm(arg)));
	  },

	  // augment one matrix by another
	  // Note: this function returns a matrix, not a jStat object
	  aug: function aug(a, b) {
	    var newarr = [];
	    for (var i = 0; i < a.length; i++) {
	      newarr.push(a[i].slice());
	    }
	    for (var i = 0; i < newarr.length; i++) {
	      push.apply(newarr[i], b[i]);
	    }
	    return newarr;
	  },

	  // The inv() function calculates the inverse of a matrix
	  // Create the inverse by augmenting the matrix by the identity matrix of the
	  // appropriate size, and then use G-J elimination on the augmented matrix.
	  inv: function inv(a) {
	    var rows = a.length;
	    var cols = a[0].length;
	    var b = jStat.identity(rows, cols);
	    var c = jStat.gauss_jordan(a, b);
	    var result = [];
	    var i = 0;
	    var j;

	    //We need to copy the inverse portion to a new matrix to rid G-J artifacts
	    for (; i < rows; i++) {
	      result[i] = [];
	      for (j = cols; j < c[0].length; j++)
	        result[i][j - cols] = c[i][j];
	    }
	    return result;
	  },

	  // calculate the determinant of a matrix
	  det: function det(a) {
	    var alen = a.length,
	    alend = alen * 2,
	    vals = new Array(alend),
	    rowshift = alen - 1,
	    colshift = alend - 1,
	    mrow = rowshift - alen + 1,
	    mcol = colshift,
	    i = 0,
	    result = 0,
	    j;
	    // check for special 2x2 case
	    if (alen === 2) {
	      return a[0][0] * a[1][1] - a[0][1] * a[1][0];
	    }
	    for (; i < alend; i++) {
	      vals[i] = 1;
	    }
	    for (var i = 0; i < alen; i++) {
	      for (j = 0; j < alen; j++) {
	        vals[(mrow < 0) ? mrow + alen : mrow ] *= a[i][j];
	        vals[(mcol < alen) ? mcol + alen : mcol ] *= a[i][j];
	        mrow++;
	        mcol--;
	      }
	      mrow = --rowshift - alen + 1;
	      mcol = --colshift;
	    }
	    for (var i = 0; i < alen; i++) {
	      result += vals[i];
	    }
	    for (; i < alend; i++) {
	      result -= vals[i];
	    }
	    return result;
	  },

	  gauss_elimination: function gauss_elimination(a, b) {
	    var i = 0,
	    j = 0,
	    n = a.length,
	    m = a[0].length,
	    factor = 1,
	    sum = 0,
	    x = [],
	    maug, pivot, temp, k;
	    a = jStat.aug(a, b);
	    maug = a[0].length;
	    for(var i = 0; i < n; i++) {
	      pivot = a[i][i];
	      j = i;
	      for (k = i + 1; k < m; k++) {
	        if (pivot < Math.abs(a[k][i])) {
	          pivot = a[k][i];
	          j = k;
	        }
	      }
	      if (j != i) {
	        for(k = 0; k < maug; k++) {
	          temp = a[i][k];
	          a[i][k] = a[j][k];
	          a[j][k] = temp;
	        }
	      }
	      for (j = i + 1; j < n; j++) {
	        factor = a[j][i] / a[i][i];
	        for(k = i; k < maug; k++) {
	          a[j][k] = a[j][k] - factor * a[i][k];
	        }
	      }
	    }
	    for (var i = n - 1; i >= 0; i--) {
	      sum = 0;
	      for (j = i + 1; j<= n - 1; j++) {
	        sum = sum + x[j] * a[i][j];
	      }
	      x[i] =(a[i][maug - 1] - sum) / a[i][i];
	    }
	    return x;
	  },

	  gauss_jordan: function gauss_jordan(a, b) {
	    var m = jStat.aug(a, b),
	    h = m.length,
	    w = m[0].length;
	    var c = 0;
	    // find max pivot
	    for (var y = 0; y < h; y++) {
	      var maxrow = y;
	      for (var y2 = y+1; y2 < h; y2++) {
	        if (Math.abs(m[y2][y]) > Math.abs(m[maxrow][y]))
	          maxrow = y2;
	      }
	      var tmp = m[y];
	      m[y] = m[maxrow];
	      m[maxrow] = tmp
	      for (var y2 = y+1; y2 < h; y2++) {
	        c = m[y2][y] / m[y][y];
	        for (var x = y; x < w; x++) {
	          m[y2][x] -= m[y][x] * c;
	        }
	      }
	    }
	    // backsubstitute
	    for (var y = h-1; y >= 0; y--) {
	      c = m[y][y];
	      for (var y2 = 0; y2 < y; y2++) {
	        for (var x = w-1; x > y-1; x--) {
	          m[y2][x] -= m[y][x] * m[y2][y] / c;
	        }
	      }
	      m[y][y] /= c;
	      for (var x = h; x < w; x++) {
	        m[y][x] /= c;
	      }
	    }
	    return m;
	  },

	  // solve equation
	  // Ax=b
	  // A is upper triangular matrix
	  // A=[[1,2,3],[0,4,5],[0,6,7]]
	  // b=[1,2,3]
	  // triaUpSolve(A,b) // -> [2.666,0.1666,1.666]
	  // if you use matrix style
	  // A=[[1,2,3],[0,4,5],[0,6,7]]
	  // b=[[1],[2],[3]]
	  // will return [[2.666],[0.1666],[1.666]]
	  triaUpSolve: function triaUpSolve(A, b) {
	    var size = A[0].length;
	    var x = jStat.zeros(1, size)[0];
	    var parts;
	    var matrix_mode = false;

	    if (b[0].length != undefined) {
	      b = b.map(function(i){ return i[0] });
	      matrix_mode = true;
	    }

	    jStat.arange(size - 1, -1, -1).forEach(function(i) {
	      parts = jStat.arange(i + 1, size).map(function(j) {
	        return x[j] * A[i][j];
	      });
	      x[i] = (b[i] - jStat.sum(parts)) / A[i][i];
	    });

	    if (matrix_mode)
	      return x.map(function(i){ return [i] });
	    return x;
	  },

	  triaLowSolve: function triaLowSolve(A, b) {
	    // like to triaUpSolve but A is lower triangular matrix
	    var size = A[0].length;
	    var x = jStat.zeros(1, size)[0];
	    var parts;

	    var matrix_mode=false;
	    if (b[0].length != undefined) {
	      b = b.map(function(i){ return i[0] });
	      matrix_mode = true;
	    }

	    jStat.arange(size).forEach(function(i) {
	      parts = jStat.arange(i).map(function(j) {
	        return A[i][j] * x[j];
	      });
	      x[i] = (b[i] - jStat.sum(parts)) / A[i][i];
	    })

	    if (matrix_mode)
	      return x.map(function(i){ return [i] });
	    return x;
	  },


	  // A -> [L,U]
	  // A=LU
	  // L is lower triangular matrix
	  // U is upper triangular matrix
	  lu: function lu(A) {
	    var size = A.length;
	    //var L=jStat.diagonal(jStat.ones(1,size)[0]);
	    var L = jStat.identity(size);
	    var R = jStat.zeros(A.length, A[0].length);
	    var parts;
	    jStat.arange(size).forEach(function(t) {
	      R[0][t] = A[0][t];
	    });
	    jStat.arange(1, size).forEach(function(l) {
	      jStat.arange(l).forEach(function(i) {
	        parts = jStat.arange(i).map(function(jj) {
	          return L[l][jj] * R[jj][i];
	        });
	        L[l][i] = (A[l][i] - jStat.sum(parts)) / R[i][i];
	      });
	      jStat.arange(l, size).forEach(function(j) {
	        parts = jStat.arange(l).map(function(jj) {
	          return L[l][jj] * R[jj][j];
	        });
	        R[l][j] = A[i][j] - jStat.sum(parts);
	      });
	    });
	    return [L, R];
	  },

	  // A -> T
	  // A=TT'
	  // T is lower triangular matrix
	  cholesky: function cholesky(A) {
	    var size = A.length;
	    var T = jStat.zeros(A.length, A[0].length);
	    var parts;
	    jStat.arange(size).forEach(function(i) {
	      parts = jStat.arange(i).map(function(t) {
	        return Math.pow(T[i][t],2);
	      });
	      T[i][i] = Math.sqrt(A[i][i] - jStat.sum(parts));
	      jStat.arange(i + 1, size).forEach(function(j) {
	        parts = jStat.arange(i).map(function(t) {
	          return T[i][t] * T[j][t];
	        });
	        T[j][i] = (A[i][j] - jStat.sum(parts)) / T[i][i];
	      });
	    });
	    return T;
	  },


	  gauss_jacobi: function gauss_jacobi(a, b, x, r) {
	    var i = 0;
	    var j = 0;
	    var n = a.length;
	    var l = [];
	    var u = [];
	    var d = [];
	    var xv, c, h, xk;
	    for (; i < n; i++) {
	      l[i] = [];
	      u[i] = [];
	      d[i] = [];
	      for (j = 0; j < n; j++) {
	        if (i > j) {
	          l[i][j] = a[i][j];
	          u[i][j] = d[i][j] = 0;
	        } else if (i < j) {
	          u[i][j] = a[i][j];
	          l[i][j] = d[i][j] = 0;
	        } else {
	          d[i][j] = a[i][j];
	          l[i][j] = u[i][j] = 0;
	        }
	      }
	    }
	    h = jStat.multiply(jStat.multiply(jStat.inv(d), jStat.add(l, u)), -1);
	    c = jStat.multiply(jStat.inv(d), b);
	    xv = x;
	    xk = jStat.add(jStat.multiply(h, x), c);
	    i = 2;
	    while (Math.abs(jStat.norm(jStat.subtract(xk,xv))) > r) {
	      xv = xk;
	      xk = jStat.add(jStat.multiply(h, xv), c);
	      i++;
	    }
	    return xk;
	  },

	  gauss_seidel: function gauss_seidel(a, b, x, r) {
	    var i = 0;
	    var n = a.length;
	    var l = [];
	    var u = [];
	    var d = [];
	    var j, xv, c, h, xk;
	    for (; i < n; i++) {
	      l[i] = [];
	      u[i] = [];
	      d[i] = [];
	      for (j = 0; j < n; j++) {
	        if (i > j) {
	          l[i][j] = a[i][j];
	          u[i][j] = d[i][j] = 0;
	        } else if (i < j) {
	          u[i][j] = a[i][j];
	          l[i][j] = d[i][j] = 0;
	        } else {
	          d[i][j] = a[i][j];
	          l[i][j] = u[i][j] = 0;
	        }
	      }
	    }
	    h = jStat.multiply(jStat.multiply(jStat.inv(jStat.add(d, l)), u), -1);
	    c = jStat.multiply(jStat.inv(jStat.add(d, l)), b);
	    xv = x;
	    xk = jStat.add(jStat.multiply(h, x), c);
	    i = 2;
	    while (Math.abs(jStat.norm(jStat.subtract(xk, xv))) > r) {
	      xv = xk;
	      xk = jStat.add(jStat.multiply(h, xv), c);
	      i = i + 1;
	    }
	    return xk;
	  },

	  SOR: function SOR(a, b, x, r, w) {
	    var i = 0;
	    var n = a.length;
	    var l = [];
	    var u = [];
	    var d = [];
	    var j, xv, c, h, xk;
	    for (; i < n; i++) {
	      l[i] = [];
	      u[i] = [];
	      d[i] = [];
	      for (j = 0; j < n; j++) {
	        if (i > j) {
	          l[i][j] = a[i][j];
	          u[i][j] = d[i][j] = 0;
	        } else if (i < j) {
	          u[i][j] = a[i][j];
	          l[i][j] = d[i][j] = 0;
	        } else {
	          d[i][j] = a[i][j];
	          l[i][j] = u[i][j] = 0;
	        }
	      }
	    }
	    h = jStat.multiply(jStat.inv(jStat.add(d, jStat.multiply(l, w))),
	                       jStat.subtract(jStat.multiply(d, 1 - w),
	                                      jStat.multiply(u, w)));
	    c = jStat.multiply(jStat.multiply(jStat.inv(jStat.add(d,
	        jStat.multiply(l, w))), b), w);
	    xv = x;
	    xk = jStat.add(jStat.multiply(h, x), c);
	    i = 2;
	    while (Math.abs(jStat.norm(jStat.subtract(xk, xv))) > r) {
	      xv = xk;
	      xk = jStat.add(jStat.multiply(h, xv), c);
	      i++;
	    }
	    return xk;
	  },

	  householder: function householder(a) {
	    var m = a.length;
	    var n = a[0].length;
	    var i = 0;
	    var w = [];
	    var p = [];
	    var alpha, r, k, j, factor;
	    for (; i < m - 1; i++) {
	      alpha = 0;
	      for (j = i + 1; j < n; j++)
	      alpha += (a[j][i] * a[j][i]);
	      factor = (a[i + 1][i] > 0) ? -1 : 1;
	      alpha = factor * Math.sqrt(alpha);
	      r = Math.sqrt((((alpha * alpha) - a[i + 1][i] * alpha) / 2));
	      w = jStat.zeros(m, 1);
	      w[i + 1][0] = (a[i + 1][i] - alpha) / (2 * r);
	      for (k = i + 2; k < m; k++) w[k][0] = a[k][i] / (2 * r);
	      p = jStat.subtract(jStat.identity(m, n),
	          jStat.multiply(jStat.multiply(w, jStat.transpose(w)), 2));
	      a = jStat.multiply(p, jStat.multiply(a, p));
	    }
	    return a;
	  },

	  // A -> [Q,R]
	  // Q is orthogonal matrix
	  // R is upper triangular
	  QR: (function() {
	    // x -> Q
	    // find a orthogonal matrix Q st.
	    // Qx=y
	    // y is [||x||,0,0,...]

	    // quick ref
	    var sum   = jStat.sum;
	    var range = jStat.arange;

	    function get_Q1(x) {
	      var size = x.length;
	      var norm_x = jStat.norm(x, 2);
	      var e1 = jStat.zeros(1, size)[0];
	      e1[0] = 1;
	      var u = jStat.add(jStat.multiply(jStat.multiply(e1, norm_x), -1), x);
	      var norm_u = jStat.norm(u, 2);
	      var v = jStat.divide(u, norm_u);
	      var Q = jStat.subtract(jStat.identity(size),
	                             jStat.multiply(jStat.outer(v, v), 2));
	      return Q;
	    }

	    function qr(A) {
	      var size = A[0].length;
	      var QList = [];
	      jStat.arange(size).forEach(function(i) {
	        var x = jStat.slice(A, { row: { start: i }, col: i });
	        var Q = get_Q1(x);
	        var Qn = jStat.identity(A.length);
	        Qn = jStat.sliceAssign(Qn, { row: { start: i }, col: { start: i }}, Q);
	        A = jStat.multiply(Qn, A);
	        QList.push(Qn);
	      });
	      var Q = QList.reduce(function(x, y){ return jStat.multiply(x,y) });
	      var R = A;
	      return [Q, R];
	    }

	    function qr2(x) {
	      // quick impletation
	      // https://www.stat.wisc.edu/~larget/math496/qr.html

	      var n = x.length;
	      var p = x[0].length;

	      x = jStat.copy(x);
	      r = jStat.zeros(p, p);

	      var i,j,k;
	      for(j = 0; j < p; j++){
	        r[j][j] = Math.sqrt(sum(range(n).map(function(i){
	          return x[i][j] * x[i][j];
	        })));
	        for(i = 0; i < n; i++){
	          x[i][j] = x[i][j] / r[j][j];
	        }
	        for(k = j+1; k < p; k++){
	          r[j][k] = sum(range(n).map(function(i){
	            return x[i][j] * x[i][k];
	          }));
	          for(i = 0; i < n; i++){
	            x[i][k] = x[i][k] - x[i][j]*r[j][k];
	          }
	        }
	      }
	      return [x, r];
	    }

	    return qr2;
	  }()),

	  lstsq: (function(A, b) {
	    // solve least squard problem for Ax=b as QR decomposition way if b is
	    // [[b1],[b2],[b3]] form will return [[x1],[x2],[x3]] array form solution
	    // else b is [b1,b2,b3] form will return [x1,x2,x3] array form solution
	    function R_I(A) {
	      A = jStat.copy(A);
	      var size = A.length;
	      var I = jStat.identity(size);
	      jStat.arange(size - 1, -1, -1).forEach(function(i) {
	        jStat.sliceAssign(
	            I, { row: i }, jStat.divide(jStat.slice(I, { row: i }), A[i][i]));
	        jStat.sliceAssign(
	            A, { row: i }, jStat.divide(jStat.slice(A, { row: i }), A[i][i]));
	        jStat.arange(i).forEach(function(j) {
	          var c = jStat.multiply(A[j][i], -1);
	          var Aj = jStat.slice(A, { row: j });
	          var cAi = jStat.multiply(jStat.slice(A, { row: i }), c);
	          jStat.sliceAssign(A, { row: j }, jStat.add(Aj, cAi));
	          var Ij = jStat.slice(I, { row: j });
	          var cIi = jStat.multiply(jStat.slice(I, { row: i }), c);
	          jStat.sliceAssign(I, { row: j }, jStat.add(Ij, cIi));
	        })
	      });
	      return I;
	    }

	    function qr_solve(A, b){
	      var array_mode = false;
	      if (b[0].length === undefined) {
	        // [c1,c2,c3] mode
	        b = b.map(function(x){ return [x] });
	        array_mode = true;
	      }
	      var QR = jStat.QR(A);
	      var Q = QR[0];
	      var R = QR[1];
	      var attrs = A[0].length;
	      var Q1 = jStat.slice(Q,{col:{end:attrs}});
	      var R1 = jStat.slice(R,{row:{end:attrs}});
	      var RI = R_I(R1);
		  var Q2 = jStat.transpose(Q1);

		  if(Q2[0].length === undefined){
			  Q2 = [Q2]; // The confusing jStat.multifly implementation threat nature process again.
		  }

	      var x = jStat.multiply(jStat.multiply(RI, Q2), b);

		  if(x.length === undefined){
			  x = [[x]]; // The confusing jStat.multifly implementation threat nature process again.
		  }


	      if (array_mode)
	        return x.map(function(i){ return i[0] });
	      return x;
	    }

	    return qr_solve;
	  }()),

	  jacobi: function jacobi(a) {
	    var condition = 1;
	    var count = 0;
	    var n = a.length;
	    var e = jStat.identity(n, n);
	    var ev = [];
	    var b, i, j, p, q, maxim, theta, s;
	    // condition === 1 only if tolerance is not reached
	    while (condition === 1) {
	      count++;
	      maxim = a[0][1];
	      p = 0;
	      q = 1;
	      for (var i = 0; i < n; i++) {
	        for (j = 0; j < n; j++) {
	          if (i != j) {
	            if (maxim < Math.abs(a[i][j])) {
	              maxim = Math.abs(a[i][j]);
	              p = i;
	              q = j;
	            }
	          }
	        }
	      }
	      if (a[p][p] === a[q][q])
	        theta = (a[p][q] > 0) ? Math.PI / 4 : -Math.PI / 4;
	      else
	        theta = Math.atan(2 * a[p][q] / (a[p][p] - a[q][q])) / 2;
	      s = jStat.identity(n, n);
	      s[p][p] = Math.cos(theta);
	      s[p][q] = -Math.sin(theta);
	      s[q][p] = Math.sin(theta);
	      s[q][q] = Math.cos(theta);
	      // eigen vector matrix
	      e = jStat.multiply(e, s);
	      b = jStat.multiply(jStat.multiply(jStat.inv(s), a), s);
	      a = b;
	      condition = 0;
	      for (var i = 1; i < n; i++) {
	        for (j = 1; j < n; j++) {
	          if (i != j && Math.abs(a[i][j]) > 0.001) {
	            condition = 1;
	          }
	        }
	      }
	    }
	    for (var i = 0; i < n; i++) ev.push(a[i][i]);
	    //returns both the eigenvalue and eigenmatrix
	    return [e, ev];
	  },

	  rungekutta: function rungekutta(f, h, p, t_j, u_j, order) {
	    var k1, k2, u_j1, k3, k4;
	    if (order === 2) {
	      while (t_j <= p) {
	        k1 = h * f(t_j, u_j);
	        k2 = h * f(t_j + h, u_j + k1);
	        u_j1 = u_j + (k1 + k2) / 2;
	        u_j = u_j1;
	        t_j = t_j + h;
	      }
	    }
	    if (order === 4) {
	      while (t_j <= p) {
	        k1 = h * f(t_j, u_j);
	        k2 = h * f(t_j + h / 2, u_j + k1 / 2);
	        k3 = h * f(t_j + h / 2, u_j + k2 / 2);
	        k4 = h * f(t_j +h, u_j + k3);
	        u_j1 = u_j + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
	        u_j = u_j1;
	        t_j = t_j + h;
	      }
	    }
	    return u_j;
	  },

	  romberg: function romberg(f, a, b, order) {
	    var i = 0;
	    var h = (b - a) / 2;
	    var x = [];
	    var h1 = [];
	    var g = [];
	    var m, a1, j, k, I, d;
	    while (i < order / 2) {
	      I = f(a);
	      for (j = a, k = 0; j <= b; j = j + h, k++) x[k] = j;
	      m = x.length;
	      for (j = 1; j < m - 1; j++) {
	        I += (((j % 2) !== 0) ? 4 : 2) * f(x[j]);
	      }
	      I = (h / 3) * (I + f(b));
	      g[i] = I;
	      h /= 2;
	      i++;
	    }
	    a1 = g.length;
	    m = 1;
	    while (a1 !== 1) {
	      for (j = 0; j < a1 - 1; j++)
	      h1[j] = ((Math.pow(4, m)) * g[j + 1] - g[j]) / (Math.pow(4, m) - 1);
	      a1 = h1.length;
	      g = h1;
	      h1 = [];
	      m++;
	    }
	    return g;
	  },

	  richardson: function richardson(X, f, x, h) {
	    function pos(X, x) {
	      var i = 0;
	      var n = X.length;
	      var p;
	      for (; i < n; i++)
	        if (X[i] === x) p = i;
	      return p;
	    }
	    var n = X.length,
	    h_min = Math.abs(x - X[pos(X, x) + 1]),
	    i = 0,
	    g = [],
	    h1 = [],
	    y1, y2, m, a, j;
	    while (h >= h_min) {
	      y1 = pos(X, x + h);
	      y2 = pos(X, x);
	      g[i] = (f[y1] - 2 * f[y2] + f[2 * y2 - y1]) / (h * h);
	      h /= 2;
	      i++;
	    }
	    a = g.length;
	    m = 1;
	    while (a != 1) {
	      for (j = 0; j < a - 1; j++)
	      h1[j] = ((Math.pow(4, m)) * g[j + 1] - g[j]) / (Math.pow(4, m) - 1);
	      a = h1.length;
	      g = h1;
	      h1 = [];
	      m++;
	    }
	    return g;
	  },

	  simpson: function simpson(f, a, b, n) {
	    var h = (b - a) / n;
	    var I = f(a);
	    var x = [];
	    var j = a;
	    var k = 0;
	    var i = 1;
	    var m;
	    for (; j <= b; j = j + h, k++)
	      x[k] = j;
	    m = x.length;
	    for (; i < m - 1; i++) {
	      I += ((i % 2 !== 0) ? 4 : 2) * f(x[i]);
	    }
	    return (h / 3) * (I + f(b));
	  },

	  hermite: function hermite(X, F, dF, value) {
	    var n = X.length;
	    var p = 0;
	    var i = 0;
	    var l = [];
	    var dl = [];
	    var A = [];
	    var B = [];
	    var j;
	    for (; i < n; i++) {
	      l[i] = 1;
	      for (j = 0; j < n; j++) {
	        if (i != j) l[i] *= (value - X[j]) / (X[i] - X[j]);
	      }
	      dl[i] = 0;
	      for (j = 0; j < n; j++) {
	        if (i != j) dl[i] += 1 / (X [i] - X[j]);
	      }
	      A[i] = (1 - 2 * (value - X[i]) * dl[i]) * (l[i] * l[i]);
	      B[i] = (value - X[i]) * (l[i] * l[i]);
	      p += (A[i] * F[i] + B[i] * dF[i]);
	    }
	    return p;
	  },

	  lagrange: function lagrange(X, F, value) {
	    var p = 0;
	    var i = 0;
	    var j, l;
	    var n = X.length;
	    for (; i < n; i++) {
	      l = F[i];
	      for (j = 0; j < n; j++) {
	        // calculating the lagrange polynomial L_i
	        if (i != j) l *= (value - X[j]) / (X[i] - X[j]);
	      }
	      // adding the lagrange polynomials found above
	      p += l;
	    }
	    return p;
	  },

	  cubic_spline: function cubic_spline(X, F, value) {
	    var n = X.length;
	    var i = 0, j;
	    var A = [];
	    var B = [];
	    var alpha = [];
	    var c = [];
	    var h = [];
	    var b = [];
	    var d = [];
	    for (; i < n - 1; i++)
	      h[i] = X[i + 1] - X[i];
	    alpha[0] = 0;
	    for (var i = 1; i < n - 1; i++) {
	      alpha[i] = (3 / h[i]) * (F[i + 1] - F[i]) -
	          (3 / h[i-1]) * (F[i] - F[i-1]);
	    }
	    for (var i = 1; i < n - 1; i++) {
	      A[i] = [];
	      B[i] = [];
	      A[i][i-1] = h[i-1];
	      A[i][i] = 2 * (h[i - 1] + h[i]);
	      A[i][i+1] = h[i];
	      B[i][0] = alpha[i];
	    }
	    c = jStat.multiply(jStat.inv(A), B);
	    for (j = 0; j < n - 1; j++) {
	      b[j] = (F[j + 1] - F[j]) / h[j] - h[j] * (c[j + 1][0] + 2 * c[j][0]) / 3;
	      d[j] = (c[j + 1][0] - c[j][0]) / (3 * h[j]);
	    }
	    for (j = 0; j < n; j++) {
	      if (X[j] > value) break;
	    }
	    j -= 1;
	    return F[j] + (value - X[j]) * b[j] + jStat.sq(value-X[j]) *
	        c[j] + (value - X[j]) * jStat.sq(value - X[j]) * d[j];
	  },

	  gauss_quadrature: function gauss_quadrature() {
	    throw new Error('gauss_quadrature not yet implemented');
	  },

	  PCA: function PCA(X) {
	    var m = X.length;
	    var n = X[0].length;
	    var flag = false;
	    var i = 0;
	    var j, temp1;
	    var u = [];
	    var D = [];
	    var result = [];
	    var temp2 = [];
	    var Y = [];
	    var Bt = [];
	    var B = [];
	    var C = [];
	    var V = [];
	    var Vt = [];
	    for (var i = 0; i < m; i++) {
	      u[i] = jStat.sum(X[i]) / n;
	    }
	    for (var i = 0; i < n; i++) {
	      B[i] = [];
	      for(j = 0; j < m; j++) {
	        B[i][j] = X[j][i] - u[j];
	      }
	    }
	    B = jStat.transpose(B);
	    for (var i = 0; i < m; i++) {
	      C[i] = [];
	      for (j = 0; j < m; j++) {
	        C[i][j] = (jStat.dot([B[i]], [B[j]])) / (n - 1);
	      }
	    }
	    result = jStat.jacobi(C);
	    V = result[0];
	    D = result[1];
	    Vt = jStat.transpose(V);
	    for (var i = 0; i < D.length; i++) {
	      for (j = i; j < D.length; j++) {
	        if(D[i] < D[j])  {
	          temp1 = D[i];
	          D[i] = D[j];
	          D[j] = temp1;
	          temp2 = Vt[i];
	          Vt[i] = Vt[j];
	          Vt[j] = temp2;
	        }
	      }
	    }
	    Bt = jStat.transpose(B);
	    for (var i = 0; i < m; i++) {
	      Y[i] = [];
	      for (j = 0; j < Bt.length; j++) {
	        Y[i][j] = jStat.dot([Vt[i]], [Bt[j]]);
	      }
	    }
	    return [X, D, Vt, Y];
	  }
	});

	// extend jStat.fn with methods that require one argument
	(function(funcs) {
	  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
	    jStat.fn[passfunc] = function(arg, func) {
	      var tmpthis = this;
	      // check for callback
	      if (func) {
	        setTimeout(function() {
	          func.call(tmpthis, jStat.fn[passfunc].call(tmpthis, arg));
	        }, 15);
	        return this;
	      }
	      if (typeof jStat[passfunc](this, arg) === 'number')
	        return jStat[passfunc](this, arg);
	      else
	        return jStat(jStat[passfunc](this, arg));
	    };
	  }(funcs[i]));
	}('add divide multiply subtract dot pow exp log abs norm angle'.split(' ')));

	}(jStat, Math));
	(function(jStat, Math) {

	var slice = [].slice;
	var isNumber = jStat.utils.isNumber;
	var isArray = jStat.utils.isArray;

	// flag==true denotes use of sample standard deviation
	// Z Statistics
	jStat.extend({
	  // 2 different parameter lists:
	  // (value, mean, sd)
	  // (value, array, flag)
	  zscore: function zscore() {
	    var args = slice.call(arguments);
	    if (isNumber(args[1])) {
	      return (args[0] - args[1]) / args[2];
	    }
	    return (args[0] - jStat.mean(args[1])) / jStat.stdev(args[1], args[2]);
	  },

	  // 3 different paramter lists:
	  // (value, mean, sd, sides)
	  // (zscore, sides)
	  // (value, array, sides, flag)
	  ztest: function ztest() {
	    var args = slice.call(arguments);
	    var z;
	    if (isArray(args[1])) {
	      // (value, array, sides, flag)
	      z = jStat.zscore(args[0],args[1],args[3]);
	      return (args[2] === 1) ?
	        (jStat.normal.cdf(-Math.abs(z), 0, 1)) :
	        (jStat.normal.cdf(-Math.abs(z), 0, 1)*2);
	    } else {
	      if (args.length > 2) {
	        // (value, mean, sd, sides)
	        z = jStat.zscore(args[0],args[1],args[2]);
	        return (args[3] === 1) ?
	          (jStat.normal.cdf(-Math.abs(z),0,1)) :
	          (jStat.normal.cdf(-Math.abs(z),0,1)* 2);
	      } else {
	        // (zscore, sides)
	        z = args[0];
	        return (args[1] === 1) ?
	          (jStat.normal.cdf(-Math.abs(z),0,1)) :
	          (jStat.normal.cdf(-Math.abs(z),0,1)*2);
	      }
	    }
	  }
	});

	jStat.extend(jStat.fn, {
	  zscore: function zscore(value, flag) {
	    return (value - this.mean()) / this.stdev(flag);
	  },

	  ztest: function ztest(value, sides, flag) {
	    var zscore = Math.abs(this.zscore(value, flag));
	    return (sides === 1) ?
	      (jStat.normal.cdf(-zscore, 0, 1)) :
	      (jStat.normal.cdf(-zscore, 0, 1) * 2);
	  }
	});

	// T Statistics
	jStat.extend({
	  // 2 parameter lists
	  // (value, mean, sd, n)
	  // (value, array)
	  tscore: function tscore() {
	    var args = slice.call(arguments);
	    return (args.length === 4) ?
	      ((args[0] - args[1]) / (args[2] / Math.sqrt(args[3]))) :
	      ((args[0] - jStat.mean(args[1])) /
	       (jStat.stdev(args[1], true) / Math.sqrt(args[1].length)));
	  },

	  // 3 different paramter lists:
	  // (value, mean, sd, n, sides)
	  // (tscore, n, sides)
	  // (value, array, sides)
	  ttest: function ttest() {
	    var args = slice.call(arguments);
	    var tscore;
	    if (args.length === 5) {
	      tscore = Math.abs(jStat.tscore(args[0], args[1], args[2], args[3]));
	      return (args[4] === 1) ?
	        (jStat.studentt.cdf(-tscore, args[3]-1)) :
	        (jStat.studentt.cdf(-tscore, args[3]-1)*2);
	    }
	    if (isNumber(args[1])) {
	      tscore = Math.abs(args[0])
	      return (args[2] == 1) ?
	        (jStat.studentt.cdf(-tscore, args[1]-1)) :
	        (jStat.studentt.cdf(-tscore, args[1]-1) * 2);
	    }
	    tscore = Math.abs(jStat.tscore(args[0], args[1]))
	    return (args[2] == 1) ?
	      (jStat.studentt.cdf(-tscore, args[1].length-1)) :
	      (jStat.studentt.cdf(-tscore, args[1].length-1) * 2);
	  }
	});

	jStat.extend(jStat.fn, {
	  tscore: function tscore(value) {
	    return (value - this.mean()) / (this.stdev(true) / Math.sqrt(this.cols()));
	  },

	  ttest: function ttest(value, sides) {
	    return (sides === 1) ?
	      (1 - jStat.studentt.cdf(Math.abs(this.tscore(value)), this.cols()-1)) :
	      (jStat.studentt.cdf(-Math.abs(this.tscore(value)), this.cols()-1)*2);
	  }
	});

	// F Statistics
	jStat.extend({
	  // Paramter list is as follows:
	  // (array1, array2, array3, ...)
	  // or it is an array of arrays
	  // array of arrays conversion
	  anovafscore: function anovafscore() {
	    var args = slice.call(arguments),
	    expVar, sample, sampMean, sampSampMean, tmpargs, unexpVar, i, j;
	    if (args.length === 1) {
	      tmpargs = new Array(args[0].length);
	      for (var i = 0; i < args[0].length; i++) {
	        tmpargs[i] = args[0][i];
	      }
	      args = tmpargs;
	    }
	    // 2 sample case
	    if (args.length === 2) {
	      return jStat.variance(args[0]) / jStat.variance(args[1]);
	    }
	    // Builds sample array
	    sample = new Array();
	    for (var i = 0; i < args.length; i++) {
	      sample = sample.concat(args[i]);
	    }
	    sampMean = jStat.mean(sample);
	    // Computes the explained variance
	    expVar = 0;
	    for (var i = 0; i < args.length; i++) {
	      expVar = expVar + args[i].length * Math.pow(jStat.mean(args[i]) - sampMean, 2);
	    }
	    expVar /= (args.length - 1);
	    // Computes unexplained variance
	    unexpVar = 0;
	    for (var i = 0; i < args.length; i++) {
	      sampSampMean = jStat.mean(args[i]);
	      for (j = 0; j < args[i].length; j++) {
	        unexpVar += Math.pow(args[i][j] - sampSampMean, 2);
	      }
	    }
	    unexpVar /= (sample.length - args.length);
	    return expVar / unexpVar;
	  },

	  // 2 different paramter setups
	  // (array1, array2, array3, ...)
	  // (anovafscore, df1, df2)
	  anovaftest: function anovaftest() {
	    var args = slice.call(arguments),
	    df1, df2, n, i;
	    if (isNumber(args[0])) {
	      return 1 - jStat.centralF.cdf(args[0], args[1], args[2]);
	    }
	    anovafscore = jStat.anovafscore(args);
	    df1 = args.length - 1;
	    n = 0;
	    for (var i = 0; i < args.length; i++) {
	      n = n + args[i].length;
	    }
	    df2 = n - df1 - 1;
	    return 1 - jStat.centralF.cdf(anovafscore, df1, df2);
	  },

	  ftest: function ftest(fscore, df1, df2) {
	    return 1 - jStat.centralF.cdf(fscore, df1, df2);
	  }
	});

	jStat.extend(jStat.fn, {
	  anovafscore: function anovafscore() {
	    return jStat.anovafscore(this.toArray());
	  },

	  anovaftes: function anovaftes() {
	    var n = 0;
	    var i;
	    for (var i = 0; i < this.length; i++) {
	      n = n + this[i].length;
	    }
	    return jStat.ftest(this.anovafscore(), this.length - 1, n - this.length);
	  }
	});

	// Tukey's range test
	jStat.extend({
	  // 2 parameter lists
	  // (mean1, mean2, n1, n2, sd)
	  // (array1, array2, sd)
	  qscore: function qscore() {
	    var args = slice.call(arguments);
	    var mean1, mean2, n1, n2, sd;
	    if (isNumber(args[0])) {
	        mean1 = args[0];
	        mean2 = args[1];
	        n1 = args[2];
	        n2 = args[3];
	        sd = args[4];
	    } else {
	        mean1 = jStat.mean(args[0]);
	        mean2 = jStat.mean(args[1]);
	        n1 = args[0].length;
	        n2 = args[1].length;
	        sd = args[2];
	    }
	    return Math.abs(mean1 - mean2) / (sd * Math.sqrt((1 / n1 + 1 / n2) / 2));
	  },

	  // 3 different parameter lists:
	  // (qscore, n, k)
	  // (mean1, mean2, n1, n2, sd, n, k)
	  // (array1, array2, sd, n, k)
	  qtest: function qtest() {
	    var args = slice.call(arguments);

	    var qscore;
	    if (args.length === 3) {
	      qscore = args[0];
	      args = args.slice(1);
	    } else if (args.length === 7) {
	      qscore = jStat.qscore(args[0], args[1], args[2], args[3], args[4]);
	      args = args.slice(5);
	    } else {
	      qscore = jStat.qscore(args[0], args[1], args[2]);
	      args = args.slice(3);
	    }

	    var n = args[0];
	    var k = args[1];

	    return 1 - jStat.tukey.cdf(qscore, k, n - k);
	  },

	  tukeyhsd: function tukeyhsd(arrays) {
	    var sd = jStat.pooledstdev(arrays);
	    var means = arrays.map(function (arr) {return jStat.mean(arr);});
	    var n = arrays.reduce(function (n, arr) {return n + arr.length;}, 0);

	    var results = [];
	    for (var i = 0; i < arrays.length; ++i) {
	        for (var j = i + 1; j < arrays.length; ++j) {
	            var p = jStat.qtest(means[i], means[j], arrays[i].length, arrays[j].length, sd, n, arrays.length);
	            results.push([[i, j], p]);
	        }
	    }

	    return results;
	  }
	});

	// Error Bounds
	jStat.extend({
	  // 2 different parameter setups
	  // (value, alpha, sd, n)
	  // (value, alpha, array)
	  normalci: function normalci() {
	    var args = slice.call(arguments),
	    ans = new Array(2),
	    change;
	    if (args.length === 4) {
	      change = Math.abs(jStat.normal.inv(args[1] / 2, 0, 1) *
	                        args[2] / Math.sqrt(args[3]));
	    } else {
	      change = Math.abs(jStat.normal.inv(args[1] / 2, 0, 1) *
	                        jStat.stdev(args[2]) / Math.sqrt(args[2].length));
	    }
	    ans[0] = args[0] - change;
	    ans[1] = args[0] + change;
	    return ans;
	  },

	  // 2 different parameter setups
	  // (value, alpha, sd, n)
	  // (value, alpha, array)
	  tci: function tci() {
	    var args = slice.call(arguments),
	    ans = new Array(2),
	    change;
	    if (args.length === 4) {
	      change = Math.abs(jStat.studentt.inv(args[1] / 2, args[3] - 1) *
	                        args[2] / Math.sqrt(args[3]));
	    } else {
	      change = Math.abs(jStat.studentt.inv(args[1] / 2, args[2].length - 1) *
	                        jStat.stdev(args[2], true) / Math.sqrt(args[2].length));
	    }
	    ans[0] = args[0] - change;
	    ans[1] = args[0] + change;
	    return ans;
	  },

	  significant: function significant(pvalue, alpha) {
	    return pvalue < alpha;
	  }
	});

	jStat.extend(jStat.fn, {
	  normalci: function normalci(value, alpha) {
	    return jStat.normalci(value, alpha, this.toArray());
	  },

	  tci: function tci(value, alpha) {
	    return jStat.tci(value, alpha, this.toArray());
	  }
	});

	// internal method for calculating the z-score for a difference of proportions test
	function differenceOfProportions(p1, n1, p2, n2) {
	  if (p1 > 1 || p2 > 1 || p1 <= 0 || p2 <= 0) {
	    throw new Error("Proportions should be greater than 0 and less than 1")
	  }
	  var pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
	  var se = Math.sqrt(pooled * (1 - pooled) * ((1/n1) + (1/n2)));
	  return (p1 - p2) / se;
	}

	// Difference of Proportions
	jStat.extend(jStat.fn, {
	  oneSidedDifferenceOfProportions: function oneSidedDifferenceOfProportions(p1, n1, p2, n2) {
	    var z = differenceOfProportions(p1, n1, p2, n2);
	    return jStat.ztest(z, 1);
	  },

	  twoSidedDifferenceOfProportions: function twoSidedDifferenceOfProportions(p1, n1, p2, n2) {
	    var z = differenceOfProportions(p1, n1, p2, n2);
	    return jStat.ztest(z, 2);
	  }
	});

	}(jStat, Math));
	jStat.models = (function(){

	  function sub_regress(endog, exog) {
	    return ols(endog, exog);
	  }

	  function sub_regress(exog) {
	    var var_count = exog[0].length;
	    var modelList = jStat.arange(var_count).map(function(endog_index) {
	      var exog_index =
	          jStat.arange(var_count).filter(function(i){return i!==endog_index});
	      return ols(jStat.col(exog, endog_index).map(function(x){ return x[0] }),
	                 jStat.col(exog, exog_index))
	    });
	    return modelList;
	  }

	  // do OLS model regress
	  // exog have include const columns ,it will not generate it .In fact, exog is
	  // "design matrix" look at
	  //https://en.wikipedia.org/wiki/Design_matrix
	  function ols(endog, exog) {
	    var nobs = endog.length;
	    var df_model = exog[0].length - 1;
	    var df_resid = nobs-df_model - 1;
	    var coef = jStat.lstsq(exog, endog);
	    var predict =
	        jStat.multiply(exog, coef.map(function(x) { return [x] }))
	            .map(function(p) { return p[0] });
	    var resid = jStat.subtract(endog, predict);
	    var ybar = jStat.mean(endog);
	    // constant cause problem
	    // var SST = jStat.sum(endog.map(function(y) {
	    //   return Math.pow(y-ybar,2);
	    // }));
	    var SSE = jStat.sum(predict.map(function(f) {
	      return Math.pow(f - ybar, 2);
	    }));
	    var SSR = jStat.sum(endog.map(function(y, i) {
	      return Math.pow(y - predict[i], 2);
	    }));
	    var SST = SSE + SSR;
	    var R2 = (SSE / SST);
	    return {
	        exog:exog,
	        endog:endog,
	        nobs:nobs,
	        df_model:df_model,
	        df_resid:df_resid,
	        coef:coef,
	        predict:predict,
	        resid:resid,
	        ybar:ybar,
	        SST:SST,
	        SSE:SSE,
	        SSR:SSR,
	        R2:R2
	    };
	  }

	  // H0: b_I=0
	  // H1: b_I!=0
	  function t_test(model) {
	    var subModelList = sub_regress(model.exog);
	    //var sigmaHat=jStat.stdev(model.resid);
	    var sigmaHat = Math.sqrt(model.SSR / (model.df_resid));
	    var seBetaHat = subModelList.map(function(mod) {
	      var SST = mod.SST;
	      var R2 = mod.R2;
	      return sigmaHat / Math.sqrt(SST * (1 - R2));
	    });
	    var tStatistic = model.coef.map(function(coef, i) {
	      return (coef - 0) / seBetaHat[i];
	    });
	    var pValue = tStatistic.map(function(t) {
	      var leftppf = jStat.studentt.cdf(t, model.df_resid);
	      return (leftppf > 0.5 ? 1 - leftppf : leftppf) * 2;
	    });
	    var c = jStat.studentt.inv(0.975, model.df_resid);
	    var interval95 = model.coef.map(function(coef, i) {
	      var d = c * seBetaHat[i];
	      return [coef - d, coef + d];
	    })
	    return {
	        se: seBetaHat,
	        t: tStatistic,
	        p: pValue,
	        sigmaHat: sigmaHat,
	        interval95: interval95
	    };
	  }

	  function F_test(model) {
	    var F_statistic =
	        (model.R2 / model.df_model) / ((1 - model.R2) / model.df_resid);
	    var fcdf = function(x, n1, n2) {
	      return jStat.beta.cdf(x / (n2 / n1 + x), n1 / 2, n2 / 2)
	    }
	    var pvalue = 1 - fcdf(F_statistic, model.df_model, model.df_resid);
	    return { F_statistic: F_statistic, pvalue: pvalue };
	  }

	  function ols_wrap(endog, exog) {
	    var model = ols(endog,exog);
	    var ttest = t_test(model);
	    var ftest = F_test(model);
	    // Provide the Wherry / Ezekiel / McNemar / Cohen Adjusted R^2
	    // Which matches the 'adjusted R^2' provided by R's lm package
	    var adjust_R2 =
	        1 - (1 - model.R2) * ((model.nobs - 1) / (model.df_resid));
	    model.t = ttest;
	    model.f = ftest;
	    model.adjust_R2 = adjust_R2;
	    return model;
	  }

	  return { ols: ols_wrap };
	})();
	  // Make it compatible with previous version.
	  jStat.jStat = jStat;

	  return jStat;
	});


/***/ }),
/* 178 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var jStatModule = __webpack_require__(177).jStat;

	module.exports = function(args) {
	    var jStatLocal = jStatModule || jStat;
	    var probability  = +args[0];
	    var mean         = +args[1];
	    var standart_dev = +args[2];

	    if ( isNaN(probability) || isNaN(mean) || isNaN(standart_dev) ) return "#VALUE!";
	    if ( probability >= 1 || probability <= 0 ) return "#NUM!";
	    if ( standart_dev <= 0 ) return "#NUM!";

	    return jStatLocal.normal.inv(probability, mean, standart_dev);
	}

/***/ }),
/* 179 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var number = +args[0];
	    var range  = args[1];
	    var order  = args[2];

	    if ( isNaN(number) ) return '#VALUE!';
	    if ( typeof order != 'number' && typeof order != 'boolean' && order !== undefined){
	        return '#VALUE!';
	    }

	    var rangeSize = range.colCount * range.rowCount;

	    var rank  = 1;
	    var count = 0;

	    for (var colNum = 0; colNum < range.colCount; colNum++) {
	        for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	            var value = range.getRangeValue(colNum, rowNum);
	            if ( !isNaN(+value) && value !== ''){
	                if ( value > number ){
	                    rank++;
	                } else if ( value == number ){
	                     count++;
	                }
	            }
	        }
	    }

	    if ( count === 0 ) return '#N/A!';

	    var rank_eq = !!order ? rangeSize - (rank - 2 + count) : rank;

	    return rank_eq;
	};


/***/ }),
/* 180 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var number = +args[0];
	    var range  = args[1];
	    var order  = args[2];

	    if ( isNaN(number) ) return '#VALUE!';
	    if ( typeof order !== 'number' && typeof order !== 'boolean' && order !== undefined){
	        return '#VALUE!';
	    }

	    var rangeSize = range.colCount * range.rowCount;

	    var rank  = 1;
	    var count = 0;

	    for (var colNum = 0; colNum < range.colCount; colNum++) {
	        for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	            var value = range.getRangeValue(colNum, rowNum);
	            if ( !isNaN(+value) && value !== ''){
	                if ( value > number ){
	                    rank++;
	                } else if ( value == number ){
	                    count++;
	                }
	            }
	        }
	    }

	    if ( count === 0 ) return '#N/A!';

	    var rankAvg = rank + (count - 1) / 2;

	    return !!order ? rangeSize + 1 - rankAvg : rankAvg;
	};

/***/ }),
/* 181 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var range = args[0];
	    var k     = args[1];

	    if ( k <= 0 ) return '#NUM!';

	    var array = [];
	    for (var colNum = 0; colNum < range.colCount; colNum++) {
	        for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	            var value = range.getRangeValue(colNum, rowNum);
	            if ( typeof value == 'number' ){
	                array.push( value );
	            }
	        }
	    }
	    if ( array.length <= 0 ) return '#NUM!';
	    if ( array.length < k )  return '#NUM!';
	    return array.sort(function(a, b) {return a - b})[k - 1];
	};


/***/ }),
/* 182 */
/***/ (function(module, exports) {

	"use strict";

	// TODO implement
	module.exports = function(args) {
	    return args[0];
	}



/***/ }),
/* 183 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var jStatModule = __webpack_require__(177).jStat;

	module.exports = function(args) {
	    var jStatLocal = jStatModule || jStat;

	    var probability = +args[0];
	    if ( isNaN(probability) ) return '#VALUE!';
	    if ( probability >= 1 ||probability <= 0 ) return "#NUM!";

	    return jStatLocal.normal.inv(probability, 0, 1);
	}

/***/ }),
/* 184 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var jStatModule = __webpack_require__(177).jStat;

	module.exports = function(args) {
	    var jStatLocal = jStatModule || jStat;

	    var probability = +args[0];
	    var mean        = +args[1];
	    var sd          = +args[2];

	    if ( isNaN(probability) || isNaN(mean) || isNaN(sd) ){
	        return '#VALUE!';
	    }
	    if ( probability <= 0 || probability >= 1 ) return '#NUM!';
	    if ( sd <= 0 ) return '#NUM!';
	    
	    var result = jStatLocal.lognormal.inv(probability, mean, sd);
	    return result
	    // return result.toFixed((result + '').split('.')[1].length - 1);
	}


/***/ }),
/* 185 */
/***/ (function(module, exports, __webpack_require__) {

	"use strict";

	var jStatModule = __webpack_require__(177).jStat;

	module.exports = function(args) {
	    var jStatLocal = jStatModule || jStat;

	    var probability = +args[0];
	    var alpha       = +args[1];
	    var beta        = +args[2];

	    if ( isNaN(probability) || isNaN(alpha) || isNaN(beta) ) return "#VALUE!";
	    if ( probability >= 1 || probability <= 0 ) return "#NUM!";
	    if ( alpha <= 0 || beta <= 0 ) return "#NUM!";

	    return jStatLocal.gamma.inv(probability, alpha, beta);
	}

/***/ }),
/* 186 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var number = +args[0];
	    var significance = +args[1];

	    if ( isNaN(number) || isNaN(significance)){
	        return "#VALUE!";
	    }

	    var isSignException = number > 0 && significance < 0; // Excel throws err in this case (not by spec)
	    var isSignificanceGreater = Math.abs(significance) > Math.abs(number);

	    if ( isSignException ) {
	        return '#NUM!';
	    }

	    if (significance === 0) {
	      return '#DIV/0!';
	    }

	    if (number === 0 || isSignificanceGreater) {
	      return 0;
	    }

	    var sign   = (number < 0 && significance > 0) ? -1 : 1;
	    var koef   = Math.abs( Math.floor(number/significance) );
	    var result = sign * significance *  koef;

	    return result;
	};


/***/ }),
/* 187 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (args) {
	    var searchValue = args[0];
	    var range       = args[1];
	    var indexNumber = +args[2];
	    var isNotExact  = args[3] === undefined || args[3] === null  ? 1 : +args[3];

	    if ( typeof +searchValue !== 'number' ) return '#N/A';

	    if ( isNaN(indexNumber) || indexNumber <= 0){
	        return '#VALUE!';
	    }

	    if ( typeof isNotExact !== 'number' && typeof isNotExact !== 'boolean'){
	        return '#VALUE!';
	    }

	    if ( indexNumber > range.rowCount) return '#REF!';

	    var matchedColNum;
	    for ( var i=0; i<range.colCount; i++ ) {
	        var val = range.getRangeValue(i, 0);

	        if ( isEqualIgnoreCaseString(val, searchValue) || val == searchValue ) {
	            matchedColNum = i;
	            break;
	        } else if (isNotExact) {
	            if ( val < searchValue ) {
	                matchedColNum = i;
	            } else if ( val > searchValue ) {
	                break;
	            }
	        }
	    }

	    if ( matchedColNum  === undefined ) {
	        return '#N/A'
	    }

	    return range.getRangeValue(matchedColNum, indexNumber-1);
	};

	function isEqualIgnoreCaseString(lhs, rhs) {
	    return typeof lhs === 'string'
	        && typeof rhs === 'string'
	        && lhs.toLowerCase() === rhs.toLowerCase();
	}


/***/ }),
/* 188 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var errors = {
	        "#NULL!":  true,
	        "#N/A":    true,
	        "#VALUE!": true,
	        "#REF!":   true,
	        "#DIV/0!": true,
	        "#NUM!":   true,
	        "#NAME?":  true
	    };

	    return  errors[args[0]] ? 1 : 0;
	};

/***/ }),
/* 189 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var number   = +args[0];
	    var decimals = (!args[1] && args[1] !== 0) ? 2 : args[1];
	    var noCommas = args[2];
	    if ( isNaN(number) ) return '#VALUE!';
	    // Round
	    number = Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);

	    if (noCommas) {
	        return number.toFixed(decimals);
	    } else {
	        return formatNumber(number, decimals);
	    }
	};

	function formatNumber(number, decimals) {
	    var d = '.'; // decimal delimeter
	    var t = ','; // digits separator
	    var s = number < 0 ? "-" : "";
	    var i = parseInt(number = Math.abs(+number || 0).toFixed(decimals)) + "";
	    var j = (j = i.length) > 3 ? j % 3 : 0;

	   	return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (decimals ? d + Math.abs(number - i).toFixed(decimals).slice(2) : "");
	};

/***/ }),
/* 190 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if ( isNaN(+args[0]) || !args[0] ) return '#VALUE!';
	    var ASCIICode = +args[0];

	    return String.fromCharCode(ASCIICode);
	};

/***/ }),
/* 191 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var range  = args[0];
	    var rowNum = +args[1];
	    var colNum = +args[2];

	    if (isNaN(rowNum) || (args[2] && isNaN(colNum)) ) return '#VALUE!';
	    if (colNum === 0) return '#VALUE!';

	    if ( isNaN(colNum) && range.rowCount == 1){
	        colNum = rowNum;
	        rowNum = 1;
	    }

	    if (rowNum > range.rowCount ) return '#REF';
	    if (colNum > range.colCount ) return '#REF';

	    colNum = colNum || 1;
	    rowNum = rowNum || 1;
	    return range.getRangeValue(colNum-1, rowNum-1);
	};


/***/ }),
/* 192 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var substring     = args[0];
	    var string        = args[1];
	    var startPosition = args[2] ? +args[2] : 1;

	    if ( isNaN(startPosition) ) return "#VALUE!";

	    var foundPosition = string.toLowerCase().indexOf(substring.toLowerCase(), startPosition - 1) + 1;

	    return foundPosition === 0 ? '#VALUE!' : foundPosition;
	};


/***/ }),
/* 193 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    throw "NOT IMPLEMENTED";
	};

/***/ }),
/* 194 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var text   = '' + args[0];
	    var start  = args[1];
	    var number = args[2];

	    if ( start  < 1 ) return '#VALUE!';
	    if ( number < 0 ) return '#VALUE!';

	    return text.substring(start - 1, start+number-1);
	};

/***/ }),
/* 195 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var number = args[0];
	    var digits = args[1];

	    if ( isNaN(number) || isNaN(digits) ) return "#VALUE!";

	    var sign = (number > 0) ? 1 : -1;
	    return sign * (Math.ceil(Math.abs(number) * Math.pow(10, digits))) / Math.pow(10, digits);
	};

/***/ }),
/* 196 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var number = args[0];
	    var digits = args[1];

	    if ( isNaN(number) || isNaN(digits) ) return "#VALUE!";

	    var sign = (number > 0) ? 1 : -1;
	    return sign * (Math.floor(Math.abs(number) * Math.pow(10, digits))) / Math.pow(10, digits);
	};

/***/ }),
/* 197 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var search = args[0];
	    var range  = args[1];
	    var type   = args[2] !== void(0) ? +args[2] : 1;

	    if ( typeof(range) != 'object' ){
	        return '#N/A'; //quick fix for error handling
	    }

	    if ( range.colCount > 1 && range.rowCount > 1){
	        return '#N/A';
	    }

	    if ( isNaN(type) ) return '#VALUE!';


	    type =    type > 0 ? 1
	            : type < 0 ? -1
	            : 0;

	    var prev = range.getRangeValue(0, 0).toString().toLowerCase();
	    var na   = '#N/A';
	    var mpos = 1;

	    for (var colNum = 0; colNum < range.colCount; colNum++) {
	        for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	            var value = range.getRangeValue(colNum, rowNum);
	            if ( type === 0 ) {
	                if ( search == value ) return mpos;
	            } else {
	                if ( colNum === 0 && rowNum === 0 ) continue;

	                var wo = value == prev ? 0 : value<prev ? -1 : 1 ;

	                if ( wo === -type ) { // wrong order
	                    return na;
	                }


	                var cmp = value == search ? 0 : value<search ? -1 : 1 ;

	                if ( cmp !== -type ) {
	                    return cmp === 0 ? ++mpos : mpos;
	                }
	            }

	            mpos = mpos + 1;
	            prev = value;
	        }
	    }

	    return type ? mpos : na;
	};


	//> "1.0348792640858566".localeCompare("109.9003449597547") return -2 !!!

/***/ }),
/* 198 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {

	    var cnt = 0;

	    for(var i = 0; i < args.length; i++){
	        if ( typeof(args[i]) == 'object' ) {
	            // Range processing
	            var range = args[i];

	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var value = range.getRangeValue(colNum, rowNum);

	                    if ( value !== "" && value !== undefined && value !== null ) {
	                        cnt++;
	                    }
	                }
	            }
	        } else {
	            // Single value
	            var value = args[i];

	            if ( value !== "" && value !== undefined && value !== null ) {
	                cnt++;
	            }
	        }
	    }
	    return cnt;
	};

/***/ }),
/* 199 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var value      = args[0];
	    var resIfError = args[1] === undefined ? "" : args[1];

	    var errors = {
	        "#NULL!":  true,
	        "#N/A":    true,
	        "#VALUE!": true,
	        "#REF!":   true,
	        "#DIV/0!": true,
	        "#NUM!":   true,
	        "#NAME?":  true
	    };

	    if (errors[value]){
	        return resIfError;
	    }
	    return value;
	};

/***/ }),
/* 200 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if ( args[0] === undefined ) return '#VALUE!';
	    return 0.4; // TODO remove after testing completed
	    return Math.random();
	};

/***/ }),
/* 201 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function() {
	    return '#NOT_IMPLEMENTED!';
	};

/***/ }),
/* 202 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function() {
	    return '#NOT_IMPLEMENTED!';
	};

/***/ }),
/* 203 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var value = args[0];

	    if (value === undefined || value === null || value === '', value === 0) {
	        return 1;
	    }

	    return 0;
	};


/***/ }),
/* 204 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var value = args[0];

	    if (typeof value === 'number') {
	        return true;
	    }

	    return false;
	};


/***/ }),
/* 205 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    if (args[1] === undefined) return '#VALUE!';
	    if (args[0] === "#N/A") return args[1];

	    return args[0];
	};

/***/ }),
/* 206 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var result = [];
	    var cleanArr = [];
	    var k = args[1];

	    if (!k || k <= 0 ) return '#NUM!';
	    if ( args.length == 2 && !isNaN(args[0])) return args[0];

	    for (var i=0; i<args.length; i++ ) {
	        if ( typeof(args[i]) == 'object' ) {
	            var range = args[i];
	            for (var colNum = 0; colNum < range.colCount; colNum++) {
	                for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	                    var val = range.getRangeValue(colNum, rowNum);
	                    if ( !isNaN(val) && val !== '' ){
	                        cleanArr.push(val);
	                    }
	                }
	            }
	        }
	    }

	    if(cleanArr.length >= k) {
	        result = cleanArr.sort(function(a, b) {
	            return a - b;
	          }).reverse();
	    } else {
	        return cleanArr.length && cleanArr.length <= k ? cleanArr[0] : '#NUM!';
	    }

	    return result[k-1];
	};


/***/ }),
/* 207 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function (args) {
	    if (args.length === 1) {
	        var text = args[0];
	        
	        if (text === 0 ) return 0;
	        if (typeof text !== 'string') return text.toString().length;
	        
	        return text.length;
	    } else {
	        throw "TOO MANY ARGUMENTS FOR FUNCTION [Len]";
	    }
	}

/***/ }),
/* 208 */
/***/ (function(module, exports) {

	"use strict";

	module.exports = function(args) {
	    var array = [];
	    var range = args[0];

	    for (var colNum = 0; colNum < range.colCount; colNum++) {
	        for (var rowNum = 0; rowNum < range.rowCount; rowNum++) {
	            var value = range.getRangeValue(colNum, rowNum);

	            if (!isNaN(value) && value !== ''){
	                array.push( +value );
	            }
	        }
	    }
	    
	    if (!array.length) return '#NUM!';

	    return median(array)
	};

	function median(numbers) {
	    var median = 0, numsLen = numbers.length;
	    numbers.sort(function(a,b){
	        return a-b;
	    });
	 
	    if ( numsLen % 2 === 0 ) {
	        // average of two middle numbers
	        median = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
	    } else { // is odd
	        // middle number only
	        median = numbers[(numsLen - 1) / 2];
	    }
	 
	    return median;
	}


/***/ })
/******/ ]);