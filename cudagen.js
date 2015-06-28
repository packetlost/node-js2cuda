  //input js code
//output cuda code

//create kernel
var kernelCode = "";

var esprima = require('../../nw/node_modules/esprima');
var estraverse = require('../../nw/node_modules/estraverse');
var esquery = require('../../nw/node_modules/esquery');
var types = require("../../nw/node_modules/ast-types");

var selectorAst, matches;
var deep = 0;

function isFloat(val)
{
	if(!isNaN ( parseFloat ( val ) )) 
	  	return !(val%1===0); 
	else
		return false;
}
var cudaTypes = {
	"int": "int",
	"float": "float",
	"string": "char*",
	"intArray": "int*",
	"floatArray": "float*",
	"object": "struct",
}; 

module.exports.generate = function(jscode)
{
	var ast = esprima.parse(jscode, []);
	var cudaCode = "";
	estraverse.traverse(ast, {
		    enter: function (node, parent) {
		    	var offset = [].fill(" ", deep*4).join('');
		        if(parent &&  parent.type == "BinaryExpression" && parent.right === node)
	        	{
	        		// if(parent.operator != '+')
	        			cudaCode += " " + parent.operator + " ";
	        			// if(node.type == "BinaryExpression")
	        				
	        	}
	        	if(parent &&  parent.type == "BinaryExpression" &&  node.type === "BinaryExpression")
	        	{
	        		cudaCode += "(";
	        	}
	        	if(parent &&  parent.type == "UpdateExpression" && parent.prefix === true)
	        	{
	        		cudaCode += " " + parent.operator;
	        	}
	        	if(parent &&  parent.type == "AssignmentExpression" && parent.right === node)
	        	{
	        		cudaCode += " " + parent.operator + " ";
	        	}
	        	if(parent &&  parent.type == "AssignmentExpression" && parent.left === node)
	        	{
	        		cudaCode += offset;
	        	}
	        	if(parent &&  parent.type == "MemberExpression" && parent.property === node)
	        	{
	        		if(parent.object.name != 'Math')
	        		{
	        			if(parent.computed === true)
		        			cudaCode += "[";
		        		else
		        			cudaCode += "."
	        		}
	        		
	        	}
	        	if(parent &&  parent.type == "IfStatement" && parent.consequent === node)
	        	{
	        		cudaCode += ")\r\n";
	        	}
	        	if(parent &&  parent.type == "IfStatement" && parent.alternate === node)
	        	{
	        		cudaCode += offset +"else\r\n";
	        	}
	        	if(parent && parent.type == "VariableDeclarator" && parent.init === node)
	        		cudaCode += " = ";

	        	if(parent && parent.type == "CallExpression" && parent.arguments[0] === node)
	        	{
	        		cudaCode +=  "(";
	        	}
	        	if (node.type == 'UnaryExpression')
	        	{
	        		if(node.prefix)
	        			cudaCode += node.operator;
	        	}

	        	if (node.type == 'ContinueStatement')
	        	{
	        		cudaCode += "continue;\r\n"
	        	}

	        	if (node.type == 'ForStatement')
	        	{
	        		cudaCode +=offset + "for(";
	        	}
	        	if (node.type == 'IfStatement')
	        	{
	        		cudaCode +=offset + "if(";
	        		deep++;
	        	}
	        	if(node.type == "BlockStatement")
	        	{
	        		if(parent && parent.type == "FunctionExpression")
			    		return;
	        		cudaCode += offset + "{\r\n";
	        		deep++;
	        	}
	        	
	        	if(node.type == "Identifier")
	        	{
	        		if(parent && parent.type == "MemberExpression" && node.name === "Math")
	        			return;

	        		if(parent && parent.type == "FunctionExpression")
			    		return;
		    		
		    		cudaCode +=  node.name;
	        	}
	        	if(node.type == "Literal")
	        	{
	        		if(parent && parent.type == "FunctionExpression")
		    			return;
		    		
	    			// if(parent && parent.type == "VariableDeclarator")
	       //  			cudaCode += " = " + node.value;
	       //  		else
	        			cudaCode += node.value;
		  
	        	}
	        	if(node.type == "VariableDeclaration")
	        	{
	        		var initVal = node.declarations[0].init.value;
	        		var type = isFloat(initVal)? 'float': 'int';
	        		cudaCode += type + " ";
	        	}
	        	if(parent &&  parent.type == "UpdateExpression" && parent.prefix === false)
	        	{
	        		cudaCode += parent.operator + " ";
	        	}
		       	

		    },
		    leave: function (node, parent) {
				
				if(node.type == "BlockStatement")
	        	{
	        		if(parent && parent.type == "FunctionExpression")
			    		return;
			    	deep--;
			    	var offset = [].fill(" ", deep*4).join('');
	        		cudaCode += offset + "}\r\n";
	        		
	        	}
	        	if(node.type == "VariableDeclaration")
	        	{
	        		if(parent && parent.type == "ForStatement")
	        			cudaCode += ";";
			    	else
	        			cudaCode += ";\r\n";
	        	}
	        	if(node.type == "UpdateExpression")
	        	{
	        		cudaCode += ")\r\n";
	        	}
	        	if(node.type == "AssignmentExpression")
	        	{
	        		cudaCode += ";\r\n";
	        	}
	        	if(node.type == "BinaryExpression")
	        	{
	        		if(parent && parent.type == "ForStatement")
	        			cudaCode += "; ";
	        		if(parent && parent.type == "BinaryExpression" && (parent.right === node || parent.left === node))
	        			cudaCode += ")"
	        	
	        	}
	        	if(node.type == "MemberExpression")
	        	{
	        		if(node.computed === true)
	        			cudaCode += "]";
	        			
	        	}
	        	if(node.type == "CallExpression")
	        	{
	        		cudaCode += ")";
	        	}
	        	if (node.type == 'UnaryExpression')
	        	{
	        		if(!node.prefix)
	        			cudaCode += node.operator;
	        	}
	        	// if(node.type == "ExpressionStatment")
	        	// {
	        	// 	deep--;
	        	// }


		       
		    }
		});
return cudaCode;
}

// var types = require("../../nw/node_modules/ast-types");
// module.exports.generate = function(jscode)
// {
// 	var ast = esprima.parse(jscode, []);
// 	var cudaCode = "";

// 	types.visit(ast, {
// 	});
// 	return cudaCode;
// }
