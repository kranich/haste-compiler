/* Compare
   If v is an ADT, return its constructor. If it's a primitive value, return
   the value itself.
*/
function C(v) {
    return v instanceof Array ? v[0] : v;
}

/* Thunk
   Creates a thunk representing the given closure.
   Since we want automatic memoization of as many expressions as possible, we
   use a JS object as a sort of tagged pointer, where the member x denotes the
   object actually pointed to. If a "pointer" points to a thunk, it has a
   member 't' which is set to true; if it points to a value, be it a function,
   a value of an algebraic type of a primitive value, it has no member 't'.

   When a thunk is evaluated, by reading the member 'x' of the "pointer," the
   closure is evaluated and the getter removed, to be replaced with the value
   returned by the thunk, and the getter finally returns the return value of
   the closure.
*/
function T(f) {
    var t = {t: true};
    t.__defineGetter__("x", function() {
        delete this['x'];
        delete this['t'];
        this.x = f();
        return this.x;
    });
    return t;
}

/* Eval
   Evaluate the given thunk t into head normal form.
   Start by evaluating the thunk; if a value is returned, return it.
   Things get more complex if the thunk returns another thunk; in that case,
   evaluate that thunk and update t to point to the value it returns; loop
   until we stop getting thunks for result.
   This way, t is always memoized fully evaluated into HNF. If we couple this
   with making Call f x => T(function() {return f(T(x));}) we get tail call
   elimination without any AST mangling. We also get slow function calls.
*/
function E(t) {
    if(t.x == undefined) {
        return t;
    }
    for(; t.x.t; t.x = t.x.x);
    return t.x;
}

/* Data constructor
   Create a data constructor function for the constructor with the given tag.
   The strict parameter contains an array of strictness notations; 1/true in
   position n means that the nth argument to the constructor should be
   evaluated before the constructor is applied.
*/
function D(tag, strict) {
    var f = function() {
        for(var i in arguments) {
            if(strict[i]) {
                E(arguments[i]);
            }
        }
        return [tag].concat(Array.prototype.slice.call(arguments));
    };
    f.arity = strict.length;
    return f;
}

/* Apply
   Applies the function f to the arguments args. If the application is under-
   saturated, a closure is returned, awaiting further arguments. If it is over-
   saturated, the function is fully applied, and the result (assumed to be a
   function) is then applied to the remaining arguments.
*/
function A(f, args) {
    var arity = f.arity ? f.arity : f.length;
    if(args.length == arity) {
        return f.apply(null, args);
    }
    if(args.length > arity) {
        var first = args.splice(0, arity);
        return A(f.apply(null, first), args);
    } else {
        var g = function() {
            var as = args.concat(Array.prototype.slice.call(arguments));
            return A(f, as);
        };
        g.arity = arity - args.length;
        return g;
    }
}

/* Throw an error.
   We need to be able to use throw as an exception so we wrap it in a function.
*/
function die(err) {
    throw err;
}

function quot(a, b) {
    return (a-a%b)/b;
}

function addC(a, b) {
    var x = a+b;
    return [1, x & 0xffffffff, x > 0x7fffffff];
}

function subC(a, b) {
    var x = a-b;
    return [1, x & 0xffffffff, x < -2147483648];
}

function sinh (arg) {
    return (Math.exp(arg) - Math.exp(-arg)) / 2;
}

function tanh (arg) {
    return (Math.exp(arg) - Math.exp(-arg)) / (Math.exp(arg) + Math.exp(-arg));
}

function cosh (arg) {
    return (Math.exp(arg) + Math.exp(-arg)) / 2;
}

function log2(x) {
    var high = 1024;
    var low = -1024;
    var i = 0;
    var x2;
    for(;;) {
        x2 = Math.pow(2, i);
        if(x2 <= (x >> 1)) {
            low = i;
            i += (high - i) >> 1;
        } else if(x2 > x) {
            high = i;
            i += (low - i) >> 1;
        } else {
            return i;
        }
    }
    return i;
}

function decodeFloat(x) {
    if(isNaN(x)) {
        return [1, -6755399441055744, 972];
    }
    var sig = x > 0 ? 1 : -1;
    if(!isFinite(x)) {
        return [1, sig * 4503599627370496, 972];
    }
    x = Math.abs(x);
    var exp = log2(x)-52;
    var man = x/Math.pow(2, exp);
    return [1, sig*man, exp];
}

function decodeDouble(x) {
    var decoded = decodeFloat(x);
    var sign = decoded[1] < 0 ? -1 : 1;
    var mantissa = decoded[1]*sign;
    var manLow = mantissa % 0x100000000;
    var manHigh = Math.floor(mantissa / 0x100000000);
    return [1, sign, manHigh, manLow, decoded[2]];
}