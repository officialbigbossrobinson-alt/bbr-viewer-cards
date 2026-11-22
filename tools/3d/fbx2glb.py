"""Mixamo FBX (character + separate animation files) -> one GLB with skin + named animations.
usage: fbx2glb.py out.glb character.fbx scale anim1.fbx[=name] anim2.fbx[=name] ...
"""
import sys, struct, json, math, os, io
from fbx import read, props70

def mat_mul(a, b):  # column-major 4x4
    o = [0.0] * 16
    for c in range(4):
        for r in range(4):
            o[c * 4 + r] = sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
    return o
def mat_inv(m):
    a = [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    n = 4; inv = [[float(i == j) for j in range(n)] for i in range(n)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(a[r][i])); a[i], a[p] = a[p], a[i]; inv[i], inv[p] = inv[p], inv[i]
        d = a[i][i]
        a[i] = [x / d for x in a[i]]; inv[i] = [x / d for x in inv[i]]
        for r in range(n):
            if r != i:
                f = a[r][i]; a[r] = [x - f * y for x, y in zip(a[r], a[i])]; inv[r] = [x - f * y for x, y in zip(inv[r], inv[i])]
    return [inv[r][c] for c in range(4) for r in range(4)]
def trans(t): return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1]
def scale(s): return [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1]
def rot_xyz(deg):  # FBX eXYZ: R = Rz * Ry * Rx
    x, y, z = [math.radians(v) for v in deg]
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]
    Ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]
    Rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    return mat_mul(Rz, mat_mul(Ry, Rx))
def quat_of(m):
    # normalise columns (remove scale)
    cols = [m[0:3], m[4:7], m[8:11]]; sc = [math.sqrt(sum(v * v for v in c)) or 1 for c in cols]
    r = [[cols[c][rr] / sc[c] for c in range(3)] for rr in range(3)]
    tr = r[0][0] + r[1][1] + r[2][2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2; w = 0.25 * s; x = (r[2][1] - r[1][2]) / s; y = (r[0][2] - r[2][0]) / s; z = (r[1][0] - r[0][1]) / s
    elif r[0][0] > r[1][1] and r[0][0] > r[2][2]:
        s = math.sqrt(1.0 + r[0][0] - r[1][1] - r[2][2]) * 2; w = (r[2][1] - r[1][2]) / s; x = 0.25 * s; y = (r[0][1] + r[1][0]) / s; z = (r[0][2] + r[2][0]) / s
    elif r[1][1] > r[2][2]:
        s = math.sqrt(1.0 + r[1][1] - r[0][0] - r[2][2]) * 2; w = (r[0][2] - r[2][0]) / s; x = (r[0][1] + r[1][0]) / s; y = 0.25 * s; z = (r[1][2] + r[2][1]) / s
    else:
        s = math.sqrt(1.0 + r[2][2] - r[0][0] - r[1][1]) * 2; w = (r[1][0] - r[0][1]) / s; x = (r[0][2] + r[2][0]) / s; y = (r[1][2] + r[2][1]) / s; z = 0.25 * s
    l = math.sqrt(x * x + y * y + z * z + w * w); return [x / l, y / l, z / l, w / l]

def objects(root):
    objs = {}
    for o in root.find('Objects').kids: objs[o.props[0]] = o
    conns = [(c.props[0], c.props[1], c.props[2], c.props[3] if len(c.props) > 3 else None) for c in root.find('Connections').all('C')]
    return objs, conns
def clean(n): return n.split('\x00')[0].replace('Model::', '').split('::')[-1]

def bones_of(root):
    objs, conns = objects(root)
    models = {i: o for i, o in objs.items() if o.name == 'Model'}
    parent = {}
    for kind, child, par, _ in conns:
        if kind == 'OO' and child in models and par in models: parent[child] = par
    info = {}
    for i, o in models.items():
        p = props70(o)
        info[i] = dict(name=clean(o.props[1]), type=o.props[2], T=list(p.get('Lcl Translation', [0, 0, 0])), R=list(p.get('Lcl Rotation', [0, 0, 0])),
                       S=list(p.get('Lcl Scaling', [1, 1, 1])), pre=list(p.get('PreRotation', [0, 0, 0])), post=list(p.get('PostRotation', [0, 0, 0])), parent=parent.get(i))
    return info, objs, conns

def local_m(b, T=None, R=None):
    T = T or b['T']; R = R or b['R']
    m = mat_mul(trans(T), mat_mul(rot_xyz(b['pre']), rot_xyz(R)))
    if any(b['post']): m = mat_mul(m, mat_inv(rot_xyz(b['post'])))
    if b['S'] != [1, 1, 1]: m = mat_mul(m, scale(b['S']))
    return m

def anim_of(path):
    ver, root = read(path)
    info, objs, conns = bones_of(root)
    cn = {i: o for i, o in objs.items() if o.name == 'AnimationCurveNode'}
    curves = {i: o for i, o in objs.items() if o.name == 'AnimationCurve'}
    node_target = {}; comp = {}
    for kind, child, par, prop in conns:
        if kind == 'OP' and child in cn and par in info: node_target[child] = (par, prop)
        if kind == 'OP' and child in curves and par in cn: comp.setdefault(par, {})[prop] = curves[child]
    tracks = {}  # bone name -> {'T': {...}, 'R': {...}}
    tmax = 0
    for cid, (bid, prop) in node_target.items():
        key = 'T' if 'Translation' in prop else 'R' if 'Rotation' in prop else 'S'
        for axis, cv in comp.get(cid, {}).items():
            kt = cv.find('KeyTime').props[0]; kv = cv.find('KeyValueFloat').props[0]
            tracks.setdefault(info[bid]['name'], {}).setdefault(key, {})[axis[-1]] = (kt, kv)
            if kt: tmax = max(tmax, kt[-1])
    return info, tracks, tmax / 46186158000.0

def sample(kt, kv, t):
    tt = t * 46186158000.0
    if not kt: return 0.0
    if tt <= kt[0]: return kv[0]
    if tt >= kt[-1]: return kv[-1]
    lo, hi = 0, len(kt) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if kt[mid] <= tt: lo = mid
        else: hi = mid
    f = (tt - kt[lo]) / (kt[hi] - kt[lo]); return kv[lo] + (kv[hi] - kv[lo]) * f

def png_jpeg(data, maxdim=1024):
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(data)).convert('RGB'); im.thumbnail((maxdim, maxdim)); out = io.BytesIO(); im.save(out, 'JPEG', quality=85); return out.getvalue(), 'image/jpeg'
    except Exception as e:
        return data, 'image/png'

def build(out, char_path, sc, anims):
    ver, root = read(char_path)
    info, objs, conns = bones_of(root)
    bone_ids = [i for i, b in info.items() if b['type'] == 'LimbNode']
    # order bones parents-first
    order = []
    def add(i):
        if i in order: return
        p = info[i]['parent']
        if p in info and info[p]['type'] == 'LimbNode': add(p)
        order.append(i)
    for i in bone_ids: add(i)
    jidx = {i: n for n, i in enumerate(order)}
    name_to_j = {info[i]['name']: jidx[i] for i in order}
    # textures + materials
    vids = {i: o for i, o in objs.items() if o.name == 'Video'}
    texs = {i: o for i, o in objs.items() if o.name == 'Texture'}
    mats = {i: o for i, o in objs.items() if o.name == 'Material'}
    tex_vid = {}; mat_tex = {}; geo_model = {}; model_mats = {}
    for kind, child, par, prop in conns:
        if child in vids and par in texs: tex_vid[par] = child
        if child in texs and par in mats and prop and 'Diffuse' in prop: mat_tex[par] = child
        if child in mats and par in info: model_mats.setdefault(par, []).append(child)
        if child in objs and objs[child].name == 'Geometry' and par in info: geo_model[child] = par
    BIN = bytearray(); views = []; accs = []
    def blob(data, target=None):
        while len(BIN) % 4: BIN.append(0)
        off = len(BIN); BIN.extend(data); v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: v['target'] = target
        views.append(v); return len(views) - 1
    def accessor(arr, fmt, typ, ctype, target=None, minmax=False):
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[typ]
        data = struct.pack('<%d%s' % (len(arr), fmt), *arr)
        a = {'bufferView': blob(data, target), 'componentType': ctype, 'count': len(arr) // n, 'type': typ}
        if minmax:
            a['min'] = [min(arr[i::n]) for i in range(n)]; a['max'] = [max(arr[i::n]) for i in range(n)]
        accs.append(a); return len(accs) - 1
    images = []; textures = []; materials = []; matmap = {}
    def material_for(mid):
        if mid in matmap: return matmap[mid]
        m = {'name': clean(mats[mid].props[1]), 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.8}}
        tid = mat_tex.get(mid)
        if tid and tid in tex_vid:
            v = vids[tex_vid[tid]]; c = v.find('Content')
            if c and c.props and isinstance(c.props[0], (bytes, bytearray)) and len(c.props[0]) > 100:
                data, mime = png_jpeg(bytes(c.props[0]))
                images.append({'bufferView': blob(data), 'mimeType': mime}); textures.append({'source': len(images) - 1})
                m['pbrMetallicRoughness']['baseColorTexture'] = {'index': len(textures) - 1}
        materials.append(m); matmap[mid] = len(materials) - 1; return matmap[mid]
    # skin clusters per geometry
    skins_geo = {}; skin_obj = {i: o for i, o in objs.items() if o.name == 'Deformer' and o.props[2] == 'Skin'}
    clusters = {i: o for i, o in objs.items() if o.name == 'Deformer' and o.props[2] == 'Cluster'}
    cl_bone = {}; skin_cls = {}
    for kind, child, par, prop in conns:
        if child in skin_obj and par in objs and objs[par].name == 'Geometry': skins_geo[par] = child
        if child in clusters and par in skin_obj: skin_cls.setdefault(par, []).append(child)
        if child in info and par in clusters: cl_bone[par] = child
    ibm = [None] * len(order)
    prims = []
    for gid, g in objs.items():
        if g.name != 'Geometry': continue
        V = g.find('Vertices').props[0]; PI = g.find('PolygonVertexIndex').props[0]
        nl = g.find('LayerElementNormal'); ul = g.find('LayerElementUV'); ml = g.find('LayerElementMaterial')
        N = nl.find('Normals').props[0] if nl else None
        nidx = nl.find('NormalsIndex').props[0] if nl and nl.find('NormalsIndex') else None
        nmap = nl.find('MappingInformationType').props[0] if nl else ''
        UV = ul.find('UV').props[0] if ul else None; UVI = ul.find('UVIndex').props[0] if ul and ul.find('UVIndex') else None
        mats_poly = ml.find('Materials').props[0] if ml else [0]
        mmode = ml.find('MappingInformationType').props[0] if ml else 'AllSame'
        nv = len(V) // 3
        # weights per control point
        wts = [[] for _ in range(nv)]
        sk = skins_geo.get(gid)
        mesh_bind = None
        for cid in skin_cls.get(sk, []):
            c = clusters[cid]; b = cl_bone.get(cid)
            if b not in jidx: continue
            ix = c.find('Indexes'); w = c.find('Weights')
            if ix and w:
                for i, ww in zip(ix.props[0], w.props[0]): wts[i].append((jidx[b], ww))
            T = c.find('Transform').props[0]; TL = c.find('TransformLink').props[0]
            mesh_bind = T
            # Mixamo / FBX 7.x: Transform is already relative to the bone (= inverse(TransformLink) * mesh bind).
            # Older exporters store the mesh's own global instead; tell them apart by checking which one undoes the bone.
            rel = mat_mul(TL, T)
            ibm[jidx[b]] = T if max(abs(x - y) for x, y in zip(rel, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])) < 1e-2 or abs(rel[13]) < abs(T[13]) else mat_mul(mat_inv(TL), T)
        # triangulate polygons, unindexed per polygon-vertex
        pos = []; nrm = []; uvs = []; jo = []; we = []; per_mat = {}
        poly = []; pv = 0; pidx = 0
        for k, vi in enumerate(PI):
            last = vi < 0; v = ~vi if last else vi
            poly.append((v, k));
            if last:
                mi = mats_poly[pidx] if mmode == 'ByPolygon' else mats_poly[0]
                for t in range(1, len(poly) - 1):
                    for (cv, kk) in (poly[0], poly[t], poly[t + 1]):
                        pos += V[cv * 3:cv * 3 + 3]
                        if N is not None:
                            ni = (nidx[kk] if nidx else kk) if 'Vertex' in nmap and 'Polygon' in nmap else cv
                            nrm += N[ni * 3:ni * 3 + 3]
                        if UV is not None:
                            ui = UVI[kk] if UVI else kk; uvs += [UV[ui * 2], 1 - UV[ui * 2 + 1]]
                        ws = sorted(wts[cv], key=lambda x: -x[1])[:4]; s = sum(x[1] for x in ws) or 1
                        ws = ws + [(0, 0.0)] * (4 - len(ws))
                        jo += [x[0] for x in ws]; we += [x[1] / s for x in ws]
                        per_mat.setdefault(mi, []).append(len(pos) // 3 - 1)
                poly = []; pidx += 1
        model = geo_model.get(gid); mlist = model_mats.get(model, [])
        pa = accessor(pos, 'f', 'VEC3', 5126, 34962, True); na = accessor(nrm, 'f', 'VEC3', 5126, 34962) if nrm else None
        ua = accessor(uvs, 'f', 'VEC2', 5126, 34962) if uvs else None
        ja = accessor(jo, 'H', 'VEC4', 5123, 34962); wa = accessor(we, 'f', 'VEC4', 5126, 34962)
        for mi, ids in per_mat.items():
            attrs = {'POSITION': pa, 'JOINTS_0': ja, 'WEIGHTS_0': wa}
            if na is not None: attrs['NORMAL'] = na
            if ua is not None: attrs['TEXCOORD_0'] = ua
            ia = accessor(ids, 'I', 'SCALAR', 5125, 34963)
            p = {'attributes': attrs, 'indices': ia, 'extras': {'part': clean(objs[model].props[1]) if model in objs else ''}}
            if mi < len(mlist): p['material'] = material_for(mlist[mi])
            prims.append(p)
    for j in range(len(order)):
        if ibm[j] is None:  # bone without weights: its inverse bind from the rest pose
            m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; i = order[j]
            chain = []
            while i in info and info[i]['type'] == 'LimbNode': chain.append(i); i = info[i]['parent']
            for c in reversed(chain): m = mat_mul(m, local_m(info[c]))
            ibm[j] = mat_inv(m)
    # nodes: [0] = root (scale), bones, mesh
    nodes = [{'name': 'BBR_Player', 'scale': [sc, sc, sc], 'children': []}]
    for j, i in enumerate(order):
        b = info[i]; m = local_m(b)
        nodes.append({'name': b['name'], 'translation': m[12:15], 'rotation': quat_of(m)})
    for j, i in enumerate(order):
        p = info[i]['parent']
        if p in jidx: nodes[1 + jidx[p]].setdefault('children', []).append(1 + j)
        else: nodes[0]['children'].append(1 + j)
    nodes.append({'name': 'body', 'mesh': 0, 'skin': 0}); nodes[0]['children'].append(len(nodes) - 1)
    skin = {'joints': [1 + j for j in range(len(order))], 'inverseBindMatrices': accessor(sum(ibm, []), 'f', 'MAT4', 5126), 'skeleton': 1}
    # animations
    animations = []
    for path, aname in anims:
        ainfo, tracks, dur = anim_of(path)
        abones = {b['name']: b for b in ainfo.values()}
        fps = 30; nf = max(2, int(round(dur * fps)) + 1); times = [i / fps for i in range(nf)]
        tacc = accessor(times, 'f', 'SCALAR', 5126, None, True)
        samplers = []; channels = []
        for nm, j in name_to_j.items():
            b = abones.get(nm) or info[order[j]]; tr = tracks.get(nm, {})
            if not tr: continue
            Tv = []; Rv = []
            for t in times:
                T = [sample(*tr['T'][a], t) if 'T' in tr and a in tr['T'] else b['T'][k] for k, a in enumerate('XYZ')]
                R = [sample(*tr['R'][a], t) if 'R' in tr and a in tr['R'] else b['R'][k] for k, a in enumerate('XYZ')]
                m = local_m(b, T, R); Tv += m[12:15]; q = quat_of(m)
                if Rv and sum(a * c for a, c in zip(q, Rv[-4:])) < 0: q = [-x for x in q]
                Rv += q
            if 'T' in tr:
                samplers.append({'input': tacc, 'output': accessor(Tv, 'f', 'VEC3', 5126), 'interpolation': 'LINEAR'}); channels.append({'sampler': len(samplers) - 1, 'target': {'node': 1 + j, 'path': 'translation'}})
            samplers.append({'input': tacc, 'output': accessor(Rv, 'f', 'VEC4', 5126), 'interpolation': 'LINEAR'}); channels.append({'sampler': len(samplers) - 1, 'target': {'node': 1 + j, 'path': 'rotation'}})
        animations.append({'name': aname, 'samplers': samplers, 'channels': channels})
        print('anim', aname, round(dur, 2), 's', nf, 'frames', len(channels), 'channels')
    gltf = {'asset': {'version': '2.0', 'generator': 'bbr fbx2glb'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': [{'name': 'body', 'primitives': prims}],
            'skins': [skin], 'materials': materials, 'images': images, 'textures': textures, 'samplers': [], 'animations': animations,
            'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': len(BIN)}]}
    if not textures: del gltf['textures'], gltf['images']
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    while len(BIN) % 4: BIN.append(0)
    with open(out, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(BIN)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(BIN), 0x004E4942)); f.write(BIN)
    print('wrote', out, round((28 + len(js) + len(BIN)) / 1e6, 2), 'MB', len(order), 'bones', len(prims), 'primitives', len(images), 'images')

if __name__ == '__main__':
    out, char, sc = sys.argv[1], sys.argv[2], float(sys.argv[3])
    an = []
    for a in sys.argv[4:]:
        p, _, n = a.partition('='); an.append((p, n or os.path.splitext(os.path.basename(p))[0]))
    build(out, char, sc, an)
