(function(){
	var DATA_SIZE = 8;
	var propType = { local: 1, global: 2 , both: 3 }

	function AddProp(typeName,propName, place,f)
	{
		if (typeName === undefined || propName === undefined || place=== undefined || f === undefined)
			throw('Invalide call AddProp');

		var has = false;
		// var typeName = type.toString();
		// typeName = typeName.substring(typeName.indexOf('function ') + 9, typeName.indexOf('(')).trim();


		var type =	typeName ===''? this : this[typeName].prototype;
		if((place === propType.local || place === propType.both) && type)
		{
			if(!type[propName])
				type[propName] = f;
			else
				has = true;
			if(has) console.log('Property ' + propName +  ' already exist in local context');
			has = false;
		}	

		if((place === propType.global || place === propType.both) && global)
		{
			var gtype = typeName ===''? global : global[typeName].prototype;
			if(!gtype[propName]) 
				gtype[propName] = f;
			else
				has = true;
			if(has) console.warn('Property ' + propName +  ' already exist in global context');
		}
		
		
	} 

	AddProp('Array', 'last', propType.both ,function(){
	        return this[this.length - 1];
	    });
	AddProp('Array', 'rmap', propType.both,function(f){
			// var n=[]; 
			// for (var i=0; i < this.length; i++ ) {
			// 	var o;
			// 	if (Object.prototype.toString.call(this[i]) === '[object Array]')
		 //    		o = this[i].map(f);
		 //    	else
		 //    		o = f(this[i],i, this);
			// 	n.push(o); 
			// }; 
			// return n;
			var res;
			if (Object.prototype.toString.call(this[0]) === '[object Array]')
		    	res = this.map(function(it) { return it.rmap(f); 	});
		    else
		    	res = this.map(f);	
		    return res;
	});

	AddProp('Array', 'each',propType.both,function(f){
		this.forEach(f);
	});

	AddProp('', 'seq',propType.both, function seq(f,t){ 
		var A = []; 
		for (var i=f;i<=t;i++){ 
			A.push(i) 
		};
		return A; 
	});

	AddProp('Array', 'eachProp',propType.both,function(f){
		Object.getOwnPropertyNames(this).each(f);
	});
	// AddProp('Object', 'mapProp',propType.both,function(f){
	// 	return Object.getOwnPropertyNames(this).map(f);
	// });
	AddProp('Buffer', 'float',propType.global,function(i){
		return this.readFloatLE(i*4);
	});
	AddProp('Buffer', 'toFloatArray',propType.both,function(){
		var array = [];
		for(var i = 0; i < this.length; i += 4)
		{
			array.push(this.readFloatLE(i));
		}
		return array;
	});
	AddProp('', 'prop',propType.local,function (name){
	    return function (object){ return  object[name]; }
	});
	AddProp('Array', 'find',propType.both,function(predicate) {
	    if (this == null) {
	      throw new TypeError('Array.prototype.find called on null or undefined');
	    }
	    if (typeof predicate !== 'function') {
	      throw new TypeError('predicate must be a function');
	    }
	    var list = Object(this);
	    var length = list.length >>> 0;
	    var thisArg = arguments[1];
	    var value;

	    for (var i = 0; i < length; i++) {
	      value = list[i];
	      if (predicate.call(thisArg, value, i, list)) {
	        return value;
	      }
	    }
	    return undefined;
	});
	AddProp('Array', 'findIndex',propType.both,function(predicate) {
    if (this == null) {
      throw new TypeError('Array.prototype.findIndex called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  });

	AddProp('Array', 'fill',propType.both,function (val, length){
		var arr = this;
		for(var i = 0; i < length; ++i){
			if(typeof(val) === 'object')
				arr.push(clone(val));
			else
				arr.push(val);
		}
	    return arr;
	});

	AddProp('', 'clone',propType.both,function clone(obj){
		if(obj == null || typeof(obj) != 'object')
			return obj;
		var temp = obj.constructor(); // changed
		for(var key in obj)
			temp[key] = clone(obj[key]);
		return temp;
	});


	AddProp('', 'cuArray',propType.local,function (name){
		var array = global.Array();
		wrapArray(array);
		return array;
	});

	function wrapArray(array)
	{
		var cuda = require('../js/cuda.js');

		array.toD = function(){
			var length = this.getArrayLength();
			var buffer;
			var view;
			switch(this.getType())
			{
				case "float":
					var buf = new ArrayBuffer(length);
					view = new Float32Array(buf);
					this.forEach(function(it,i){
						view[i] = it;
					});
					buffer = toBuffer(buf);
					break;
				case "int":
					var buf = new ArrayBuffer(length);
					view = new Int32Array(buf);
					this.forEach(function(it,i){
						view[i] = it;
					});
					buffer = toBuffer(buf);
					break;
				case "object":
	    				var objBuffers = [];
	    				var code;
	    				this.forEach(function(it,i){
	    					wrapObject(it);
	    					var struct = it.getStruct();
	    					if(!code)
	    						code = struct.code;
	    					else
	    						if(code != struct.code)
	    							throw('Untyped array');

	    					objBuffers.push(struct.buffer);
	    				});
	    				buffer = Buffer.concat(objBuffers);
					break;
				default:
					throw('Error array type');
			}
		
			var mem  = cuda.memAlloc(buffer.length);
			this._cudamem = mem;
			this._bufferL = buffer.length;


			
			this._cudamem.copyHtoD(buffer); 
		}

		array.toH = function()
		{
			var length = this._bufferL;
			var mem = this._cudamem;
			var nodeBuffer = Buffer(length);
			mem.copyDtoH(nodeBuffer, length);
			var buffer = toArrayBuffer(nodeBuffer);
			var offset = 0;
			if(isObject(this[0]))
			{
				this.forEach(function(it, i){
					//code for reconstracting object from buffer
					//object to H from D
					it.fields.forEach(function(field, i2){
						switch(field.type)
						{
							case "float":
								var view = new Float32Array(buffer, offset, 1);
								it[field.name] = view[0];
								offset += field.size;
								break;
							case "int":
								var view = new Int32Array(buffer, offset, 1);
								it[field.name] = view[0];
								offset += field.size;
								break;
							case "array":
								it[field.name].toH();
								offset += field.size;
								break;
						}
					});
					fields = it.fields;
				});
			}
			else
			{
				view = new Float32Array(buffer);
				for(var i = 0; i < view.length; ++i){
					this[i] = view[i];
				};
			}
			

		}

		array.getStruct = function()
		{
			
			if (this.__struct != undefined)
				return this.__struct;
			var code = "typedef struct {\r\n"
			var nodeBuffers = [];
			var name;
			this.toD();

			

			switch(this.getType())
			{
				case "float":
					code += "float* cuData;\r\n";
					name = "Float";
					break;
				case "int":
					name  = "Int"
					code += "int* cuData;\r\n";
					break;
				case "object":
					wrapObject(this[0])
					var temp = this[0].getStruct();
					name =  temp.name;
					code += temp.name + "* cuData;\r\n";
					code =  temp.code + ' ' + temp.name + ";\r\n" + code;
					break;
				default:
					throw('Error array type');
			}
			var buffer;
			var pointer =  this.getDevPointer();
			// buffer = new Uint8Array(pointer);
			// nodeBuffers.push(toBuffer(buffer));
			nodeBuffers.push(pointer);

			code += "int length; \r\n";
			buffer = new ArrayBuffer(4);
			view = new Uint32Array(buffer);
			view[0] = this.length;
			nodeBuffers.push(toBuffer(buffer));
			
		
			code +="}"

			this.__struct = {
				code: code,
				buffer: Buffer.concat(nodeBuffers),
				name:  "Array" + name,
			}

			return this.__struct; 
		}

		array.getDevPointer = function()
		{
			return this._cudamem.devicePtr;
		}


		array.getType = function(){
			var esprima = require('../nw/node_modules/esprima');
			var ast = esprima.parse(JSON.stringify(this,null,4), []);
			var estraverse = require('../nw/node_modules/estraverse');
			var type;
			estraverse.traverse(ast, {
			    enter: function (node, parent) {
		    		if(node.type === "ArrayExpression")
		    		{
		    			if(node.elements[0].type === "Literal")
		    			{
							// if(node.elements[0].raw.indexOf('.') != -1)
			    				type = "float";

				    		// if(node.elements[0].raw.indexOf('.') == -1)
				    		// 	type = "int";
		    			}
		    			if(node.elements[0].type === "ObjectExpression")
		    				type = "object";
		    			return estraverse.VisitorOption.Break;
		    		}
			    },
			    leave: function (node, parent) {
					
			    }
			});
			return type;
		}

		array.getArrayLength = function ()
		{
			var json = JSON.stringify(this,function (key, value) {
				  if (isNumeric(value)) {
				    return 'nnnn'; // 4 bytes
				  }
				  if (isBool(value)) {
				    return 'b';		// 1 bytes
				  }
				  if(key === "fields")
				 	 return undefined;
				  if(key === "_cudamem")
				  	return undefined;
				  if(key === "_bufferL")
				  	return undefined;
				  return value;
			});
			json = '"' + json + '"';
			json = json.replace(/"[\w]+?"(?![},\]])/g,'');
			json = json.replace(/"[\W]+?"/g,'');
			return json.length;
		}
	}

	AddProp('', 'cuObject',propType.local,function (name){
		var object = global.Object();
		wrapObject(object);
		return object;
	});
	function wrapObject(object)
	{
		object.toH = function()
		{
			if(this.__mem != undefined)
			{
				var length = this.__mem.size;
				var mem = this.__mem;
				var nodeBuffer = Buffer(length);
				mem.copyDtoH(nodeBuffer, length);
				var buffer = toArrayBuffer(nodeBuffer);
				var offset = 0;	
				var arr = this;
				this.fields.forEach(function(field, i2){
						switch(field.type)
						{
							case "float":
								var view = new Float32Array(buffer, offset, 1);
								arr[field.name] = view[0];
								offset += field.size;
								break;
							case "int":
								var view = new Int32Array(buffer, offset, 1);
								arr[field.name] = view[0];
								offset += field.size;
								break;
							case "array":
								arr[field.name].toH();
								offset += field.size;
								break;
						}
					});
			}
		}
		object.getStruct = function()
		{
			if (this.__struct != undefined)
				return this.__struct;

			var object = this;
			object.fields = [];
			var code = "typedef struct {\r\n"
			var nodeBuffers = [];
			var esprima = require('../nw/node_modules/esprima');
			var md5  = require('../nw/node_modules/md5');
			var model = {};
			for(prop in this)
				if(this.hasOwnProperty(prop))
				{
					var v = this[prop];
					if(!isFunction(v)) model[prop] = v;
				}
			var ast = esprima.parse('(' + JSON.stringify(model,null,4) + ')', []);
			var estraverse = require('../nw/node_modules/estraverse');
			var arrayStructsCodes = [];

			estraverse.traverse(ast, {
			    enter: function (node, parent) {
			    	if(node.type === "Property" && node.key.value != "fields")
			    	{
			    		var _node = {};
			    		var negative = false;
			    		if(node.value.type === "UnaryExpression")
			    		{
			    			_node = node;
			    			_node.value = node.value.argument;
			    			negative = true;
			    		}
			    		else
			    		{
			    			_node = node;
			    		}
			    		if(_node.value.type === "Literal" && isNumeric(_node.value.value))
			    		{
			    			var buffer;
			    			if(_node.value.raw.indexOf('.') != -1)
			    			{
			    				code += "float ";
			    				buffer = new ArrayBuffer(4);
			    				var view = new Float32Array(buffer);
			    				view[0] = negative? -parseFloat(_node.value.value):parseFloat(_node.value.value);
			    				nodeBuffers.push(toBuffer(buffer));
			    				object.fields.push({type: "float", size: 4 , name:_node.key.value });
			    			}
				    		if(_node.value.raw.indexOf('.') == -1)
				    		{
				    			code += "int ";
				    			buffer = new Int32Array(1);
				    			buffer[0] = negative? -parseInt(_node.value.value):parseInt(_node.value.value);
			    				nodeBuffers.push(toBuffer(buffer));
			    				object.fields.push({type: "int", size: 4, name:_node.key.value});
				    		}
			    		}
			    		
			    		if(node.value.type === "ArrayExpression")
			    		{
			    			if(node.value.elements[0].type == "Literal" || isNumeric(node.value.elements[0].value))
			    			{
			    				if(model[node.key.value].length != 0)
			    				{
			    					wrapArray(model[node.key.value]);
			    					var arrStruct = model[node.key.value].getStruct();
				    				code += arrStruct.name + " ";
				    				nodeBuffers.push(arrStruct.buffer);
				    				var fields;
				    				if(isObject(model[node.key.value]))
										fields = model[node.key.value].fields
									if(isFloat(model[node.key.value]))
										fields = [ {type: "float", size: 4 } ];


				    				object.fields.push({type: "array", size: arrStruct.buffer.length, name: node.key.value, fields: fields});
				    				if(!arrayStructsCodes.find(function(it) { return it.code === arrStruct.code}))
				    					arrayStructsCodes.push(arrStruct);

			    				}
			    				if (model[node.key.value].length == 0)
			    					console.warn('Contain empty array');
			    				
			    			}
			    		}
			    		code += node.key.value + ';\r\n';
			    	}
			    },
			    leave: function (node, parent) {
					
			    }
			});
			code += "}";
			arrayStructsCodes.forEach(function(it){
				code = it.code + ' ' + it.name + '; \r\n' + code;
			})

			this.__struct = {
				code: code,
				buffer: Buffer.concat(nodeBuffers),
				name:  "Object" + md5.digest_s( code )  ,
			} 

			return this.__struct;
		}
	}



	// AddProp('Object', 'save',propType.both,function (path){
	// 	var fs = require('fs');
	//     var obInJSON = JSON.stringify(this, null, 4);
	// 	fs.writeFileSync(path, obInJSON);
	// });
	// AddProp('Object', 'load',propType.local,function (path){
	// 	var fs = require('fs');
	//     var objInJSON =	fs.readFileSync(path);
	// 	var obj = JSON.parse(objInJSON);
	// 	return obj;
	// });

	AddProp('Array', 'cuEach',propType.both, function(f,scoupeParams, repeat){
		var cuda = require('../js/cuda.js');
		// var mem = cuda.memAlloc(100);
		// var buf = new Buffer(100);
		// for(var i =0 ; i < 100; ++i)
		// 	buf[i] = i;
		// mem.copyHtoD(buf);
		// var mem2 = cuda.createByPtr(mem.devicePtr);
		// var buf2 = new Buffer(100);
		// mem2.copyDtoH(buf2);
		// console.log(buf2);
		if(!repeat || this.prog === undefined)
		{
			var code = '(' + f.toString() + ')';
			var params = [];

			//i (second parametr) replaced by id
			//it (first) replaced by this[id]
			var temp = code;
			code = code.substring(code.indexOf('{'));
			var re = new RegExp('([\\W])('+ 'i' + ')(?=[\\W])', "g");
			code = code.replace(re,'$1id'  );
			var re = new RegExp('([\\W])('+ 'it' + ')(?=[\\W])', "g");
			code = code.replace(re, '$1this[id]'  );
			code = temp.substring(0 ,temp.indexOf('{')) + code;

			//var re = new RegExp('[^A-Za-z]?this(?![^A-Za-z]?)');
			var re = new RegExp('this(?=\\[)', "g");
			code = code.replace(re,'hghj2uYub1jHyg_this' );
			re = new RegExp('this(?=\\.)', "g");
			code = code.replace(re,'hghj2uYub1jHyg_this');
			var p = scoupeParams.find(function(it){return it.name === "hghj2uYub1jHyg_this"});
			if(p === undefined || (p != undefined && p.update === true) || this.prog === undefined)
			{
				params.push({
					name: "hghj2uYub1jHyg_this",
					data: this,
					state: 'w'
				})
			}
			
			scoupeParams.forEach(function  (it,i) {
				if(it.name === "this") return;
				if(it.update || this.prog === undefined ) //HACK this.prog === undefined is chit for first time loading
					params.push({
						name: it.name,
						data: it.data,
						state: it.state,
					});
			});
			
			//create kernel
			var kernelCode = "";
			var cujs = require('../js/cujs/cudagen.js');
			var kernelCode = cujs.generate(code);

			//UNDONE apply pattern matching 
			var fparams = [];
			var structs = [];
			var buffers = [];
			var types = [];
			//code below inferences types of parameters
			//HACK
			var re = new RegExp("(?=\\[)", "g");
			kernelCode = kernelCode.replace(re, '.cuData');
			params.forEach(function(it, i){
				if (isArray(it.data))
				{
					if(it.data.length == 0)
					{
						console.warn('Contain empty array');
						return;
					}
					wrapArray(it.data);

					var struct =  it.data.getStruct();
					var structCode = structs.find(function(it){ return it.code.indexOf(struct.code) != -1   });
					if(!structCode)
						structs.push(struct);

					buffers.push({data: struct.buffer, dtype: "DevicePtr"});
					fparams.push(struct.name + "* " + it.name);
					// var re = new RegExp(it.name + '(?=\\[)' , "g");
					// kernelCode = kernelCode.replace(re, '(*' + it.name + ').cuData');
					re = new RegExp('([\\W])'+ it.name+'(?=\\.)', "g");
					kernelCode = kernelCode.replace(re, '$1(*' + it.name + ')');
				}
				if (Object.prototype.toString.call(it.data) === '[object Number]')
				{ 
					if(it.state.indexOf('w') != -1)
					{
						// var mem  = cuda.memAlloc(4);
						// var buffer = new ArrayBuffer(4);
						// var view = new Float32Array(buffer);
						// view[0] = it.data;
						// var nBuf = toBuffer(buffer);
						// // mem.copyHtoD(nBuf);
						// // it._mem = mem;
						// buffers.push({data: nBuf, dtype: "DevicePtr"});
						// fparams.push("float* " + it.name);
						
					}
					else
					{
						buffers.push({data: it.data, dtype: "Float32"});
						fparams.push("float " + it.name);
					}
					


				}
				if (isObject(it.data) && !isArray(it.data))
				{
					wrapObject(it.data);
					var struct = it.data.getStruct();
					// it.data.toD();
					if(it.state != undefined)
						buffers.push({data: struct.buffer, dtype: "DevicePtr", ref: it.state.indexOf('w') != -1? it: undefined});
					else
						buffers.push({data: struct.buffer, dtype: "DevicePtr", ref:  undefined});
					fparams.push(struct.name + "* " + it.name);
					var structCode = structs.find(function(it){ return it.code.indexOf(struct.code) != -1  });
					if(!structCode)
						structs.push(struct);
					var re = new RegExp('([\\W])'+ it.name+'(?=\\.)', "g");
					kernelCode = kernelCode.replace(re, '$1(*' + it.name + ')');


					// var wrap = wrapObject(it);
					// buffers.push({data: wrap.buffer, dtype: "DevicePtr"});
					// headers.push(wrap.text);
					// fparams.push(wrap.name);
				}

				
			});

			
			if(this.prog === undefined)
			{
				var headers = structs.map(function(it){return it.code + ' ' +  it.name + ';\r\n'});
			
				var prog = headers.join('\r\n') + '\r\n'  + `
					extern "C" {
						__global__ void gpuFunc_ ` +  `(` + fparams.join(', ') + `) {
							 int id = blockIdx.x * blockDim.x + threadIdx.x;
							 if (id < (*hghj2uYub1jHyg_this).length) {\n\r`	 + kernelCode + `
							};
						}
					}
				`
				console.log(prog);

				// var rtc = new cuda.RTC();
				// rtc.createProgram(prog);
				// rtc.compileProgram([
				// "--gpu-architecture=compute_20",
		  //       // '--machine 32',
				// ]);
				var CachePath = "../js/particles/cache/";
				var cacheFile = "test.ptx";
				var TempPath = "../js/particles/temp/";
				var sourceFile = "test.cu";
				var fs = require('fs');
				var path = require('path');

				fs.writeFileSync(TempPath + sourceFile, prog);

				console.info( require('child_process').execSync(
			     [
			       'nvcc --ptx',
			       '--gpu-architecture compute_20',
			       '--gpu-code sm_20',
			       '-maxrregcount=0',
			       '--machine 32',
			       '--compile  --use_fast_math -Xptxas -v,-abi=no -use_fast_math ',
			       '-o ' + '\"' + path.resolve(CachePath + cacheFile)+'\"',
			       '\"'+ path.resolve(TempPath + sourceFile)+'\"'
			    ].join(' '), {encoding: 'utf8'}) );

				// var module = cuda.moduleLoadPTX(rtc);

				var module = cuda.moduleLoad(CachePath + cacheFile);
				console.log("Loaded module:", module);

				var func = module.getFunction('gpuFunc_');
				this.prog = func;
				console.log(func);
				var typeByteSize = {
				  "Uint8": 1,
				  "Uint16": 2,
				  "Uint32": 4,
				  "Int8": 1,
				  "Int16": 2,
				  "Int32": 4,
				  "Float32": 4,
				  "Float64": 8,
				  "DevicePtr": 8
				};
			}

			var kernParam = [];
			buffers.forEach(function(it,i){
				if(it.dtype === "DevicePtr")
				{
					var buf = it.data;
					var mem1  = cuda.memAlloc(buf.length);
					var error = mem1.copyHtoD(buf, buf.length);
					it.data = mem1.devicePtr;
					if(it.ref != undefined)
						it.ref.data.__mem = mem1;
				}
				kernParam.push({ type:it.dtype , value: it.data});
			});
			this.kernParam = kernParam;
		}
		var kernParam = this.kernParam ;
		var func = this.prog;
		var n = this.length;
		console.log(n);
		var p = 256;
		var error = cuda.launch(func, [Math.floor((n + (p-1)) / p), 1, 1], [p, 1, 1], kernParam);
		console.log(error);
		this.toH();
		scoupeParams.forEach(function(it){
			if(it.name === "this") return;
			if(it.state.indexOf('w') == -1) return;
			// if(isNumeric(it.data))
			// {
			// 	it.data.toH();
			// 	it.data = it.data[it.name];
			// }
			// else
			// {
				it.data.toH();
			// }

			// console.log(it.data);
		})
		// console.log(this);

		// mem1.copyDtoH(buf);
		// console.log(buf);
		// var array = toArrayBuffer(buf);
		// console.log(array);
		// view = new Float32Array(array);
		// var normalArray = Array.prototype.slice.call(view);
		// console.log(normalArray);
		// var error = ctx.synchronize(function(error) {
		//     console.log("Context synchronize with error code: " + error);

		//     //cuMemFree
		//     var error = cuMem.free();
		//     console.log("Mem Free with error code: " + error);

		//     //cuCtxDestroy
		//     error = ctx.destroy();
		//     console.log("Context destroyed with error code: " + error);
		// });
	});
	
	
	function isFunction(functionToCheck) {
		return functionToCheck && Object.prototype.toString.call(functionToCheck) === '[object Function]';
	}
	function isFloat(val)
	{
		if(!isNaN ( parseFloat ( val ) )) 
		  	return !(val%1===0); 
		else
			return false;
	}
	function isBool(val)
	{
		return typeof val === 'boolean';
	}
	function isInt(val)
	{
		return !isNan(parseInt(val)) ? (val%1===0) : false;
	}
	function isObject(val)
	{
		return Object.prototype.toString.call(val) === '[object Object]';
	}
	function isArray(val)
	{
		return Object.prototype.toString.call(val) === '[object Array]';
	}
	function isString(val)
	{ 
		console.log(Object.prototype.toString.call(val));
		return Object.prototype.toString.call(val) === '[object String]';
	}
	function isNumeric(val)
	{
		return !isArray( val ) && (val - parseFloat( val ) + 1) >= 0;
	}
	function toBuffer(ab) {
	    var buffer = new Buffer(ab.byteLength);
	    var view = new Uint8Array(ab);
	    for (var i = 0; i < buffer.length; ++i) {
	        buffer[i] = view[i];
	    }
	    return buffer;
	}
	function toArrayBuffer(buffer) {
	    var ab = new ArrayBuffer(buffer.length);
	    var view = new Uint8Array(ab);
	    for (var i = 0; i < buffer.length; ++i) {
	        view[i] = buffer[i];
	    }
	    return ab;
	}
	function replaceVarName(code, oldName,newName) {
		var newCode = "";
		var re = new RegExp(oldName +'(?=\\[)');
		newCode = code.replace(re, newName);
		re = new RegExp(oldName +'(?=\\.)');
		return newCode.replace(re, newName);
	}
})();




