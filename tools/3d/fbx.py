"""Minimal binary FBX reader (enough for Mixamo characters + animations)."""
import struct, zlib, sys

class Node:
    __slots__ = ('name', 'props', 'kids')
    def __init__(s, name, props, kids): s.name, s.props, s.kids = name, props, kids
    def find(s, n): return next((k for k in s.kids if k.name == n), None)
    def all(s, n): return [k for k in s.kids if k.name == n]
    def __repr__(s): return f'<{s.name} {[p if not isinstance(p,(list,bytes)) else type(p).__name__+str(len(p)) for p in s.props][:4]} kids={len(s.kids)}>'

def read(path):
    b = open(path, 'rb').read()
    assert b[:20] == b'Kaydara FBX Binary  ', 'not binary FBX'
    ver = struct.unpack_from('<I', b, 23)[0]
    big = ver >= 7500
    off = 27
    def rprop(o):
        t = chr(b[o]); o += 1
        if t == 'Y': return struct.unpack_from('<h', b, o)[0], o + 2
        if t == 'C': return b[o] != 0, o + 1
        if t == 'I': return struct.unpack_from('<i', b, o)[0], o + 4
        if t == 'F': return struct.unpack_from('<f', b, o)[0], o + 4
        if t == 'D': return struct.unpack_from('<d', b, o)[0], o + 8
        if t == 'L': return struct.unpack_from('<q', b, o)[0], o + 8
        if t in 'SR':
            n = struct.unpack_from('<I', b, o)[0]; o += 4; v = b[o:o + n]; o += n
            return (v.decode('utf8', 'replace') if t == 'S' else v), o
        if t in 'fdlib':
            n, enc, cl = struct.unpack_from('<III', b, o); o += 12
            raw = b[o:o + cl]; o += cl
            if enc == 1: raw = zlib.decompress(raw)
            fmt = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': 'B'}[t]
            return list(struct.unpack('<%d%s' % (n, fmt), raw)), o
        raise ValueError('prop type ' + t)
    def rnode(o):
        if big: end, np_, pl = struct.unpack_from('<QQQ', b, o); o += 24
        else: end, np_, pl = struct.unpack_from('<III', b, o); o += 12
        nl = b[o]; o += 1; name = b[o:o + nl].decode('ascii', 'replace'); o += nl
        if end == 0: return None, o
        props = []
        for _ in range(np_): v, o = rprop(o); props.append(v)
        kids = []
        while o < end:
            k, o2 = rnode(o)
            if k is None: o = o2; break
            kids.append(k); o = o2
        return Node(name, props, kids), end
    top = []
    while off < len(b) - 200:
        n, off2 = rnode(off)
        if n is None: break
        top.append(n); off = off2
    return ver, Node('root', [], top)

def props70(node):
    out = {}
    p = node.find('Properties70')
    if p:
        for P in p.all('P'): out[P.props[0]] = P.props[4:]
    return out

if __name__ == '__main__':
    ver, root = read(sys.argv[1])
    print('FBX', ver, [k.name for k in root.kids])
    objs = root.find('Objects')
    from collections import Counter
    print(Counter(k.name + ':' + (k.props[2] if len(k.props) > 2 and isinstance(k.props[2], str) else '') for k in objs.kids))
    gs = props70(root.find('GlobalSettings'))
    print('UpAxis', gs.get('UpAxis'), 'UnitScale', gs.get('UnitScaleFactor'), 'TimeMode', gs.get('TimeMode'), 'Stop', gs.get('TimeSpanStop'))
