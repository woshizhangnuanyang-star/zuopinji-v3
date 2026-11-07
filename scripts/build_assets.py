"""Build small, original glTF assets for the waterfront portfolio.

No packages or downloaded source art are required. Coordinates are metres-ish:
Y is up, the front of each building faces +Z, and all feet sit at Y=0.
Each GLB exposes wall / roof / windows / door / details nodes for animation.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import struct
import random
from collections import defaultdict

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / "public" / "assets"


def linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(value: str) -> list[float]:
    return [linear(int(value[i:i + 2], 16) / 255) for i in (1, 3, 5)] + [1.0]


PALETTE = {
    "ivory": "#fff1ef", "pink": "#e9a4c5", "pink_dark": "#d68fad",
    "indigo": "#494383", "roof_edge": "#60558d", "roof_seam": "#635c96",
    "window": "#a9d8e5", "lavender": "#a7a4c7", "frame": "#fff7f0",
    "door": "#736999", "step": "#d3c6d0", "yellow": "#ffe49a",
}


class Geometry:
    def __init__(self):
        self.parts = defaultdict(lambda: {"p": [], "n": [], "i": []})

    def face(self, points, material):
        part = self.parts[material]
        start = len(part["p"]) // 3
        u = [points[1][i] - points[0][i] for i in range(3)]
        v = [points[2][i] - points[0][i] for i in range(3)]
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length = math.sqrt(sum(x*x for x in n)) or 1
        n = [x / length for x in n]
        for point in points:
            part["p"].extend(point)
            part["n"].extend(n)
        for j in range(1, len(points)-1):
            part["i"].extend((start, start+j, start+j+1))

    def box(self, cx, cy, cz, width, height, depth, material):
        x0, x1 = cx-width/2, cx+width/2
        y0, y1 = cy-height/2, cy+height/2
        z0, z1 = cz-depth/2, cz+depth/2
        for points in (
            [(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],
            [(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0)],
            [(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)],
            [(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1)],
            [(x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0)],
            [(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)],
        ):
            self.face(points, material)


class Building:
    def __init__(self, name, dimensions):
        self.name, self.dimensions = name, dimensions
        self.groups = {n: Geometry() for n in ("wall", "roof", "windows", "door", "details")}

    def shell(self, width, depth, wall, ridge, x=0, front_material="ivory"):
        g = self.groups["wall"]
        g.box(x, wall/2, 0, width, wall, depth, "ivory")
        g.face([(x-width/2,wall,depth/2+.001),(x+width/2,wall,depth/2+.001),(x,ridge,depth/2+.001)],front_material)
        g.face([(x+width/2,wall,-depth/2-.001),(x-width/2,wall,-depth/2-.001),(x,ridge,-depth/2-.001)],"ivory")

    def roof(self, width, depth, wall, ridge, x=0, seams=True):
        g = self.groups["roof"]
        a = width/2 + .12
        b = depth/2 + .13
        low = wall + .035
        high = ridge + .09
        g.face([(x-a,low,b),(x,high,b),(x,high,-b),(x-a,low,-b)],"indigo")
        g.face([(x,high,b),(x+a,low,b),(x+a,low,-b),(x,high,-b)],"indigo")
        # Thin roof fascia gives the cut-paper roof a readable physical edge.
        g.face([(x-a,low-.07,b),(x,high-.07,b),(x,high,b),(x-a,low,b)],"roof_edge")
        g.face([(x,high-.07,b),(x+a,low-.07,b),(x+a,low,b),(x,high,b)],"roof_edge")
        g.face([(x,high,-b),(x+a,low,-b),(x+a,low-.07,-b),(x,high-.07,-b)],"roof_edge")
        g.face([(x-a,low,-b),(x,high,-b),(x,high-.07,-b),(x-a,low-.07,-b)],"roof_edge")
        g.box(x-a,low-.025,0,.035,.075,2*b,"roof_edge")
        g.box(x+a,low-.025,0,.035,.075,2*b,"roof_edge")
        g.box(x,high+.004,0,.045,.04,2*b+.02,"roof_edge")
        if seams:
            for j in range(1, 10):
                off = a*j/10
                for sign in (-1,1):
                    q0, q1 = sign*(off-.005), sign*(off+.005)
                    h0 = high-abs(q0)/a*(high-low)+.003
                    h1 = high-abs(q1)/a*(high-low)+.003
                    if sign<0:
                        g.face([(x+q1,h1,b),(x+q0,h0,b),(x+q0,h0,-b),(x+q1,h1,-b)],"roof_edge")
                    else:
                        g.face([(x+q0,h0,b),(x+q1,h1,b),(x+q1,h1,-b),(x+q0,h0,-b)],"roof_edge")

    def cladding(self, width, depth, height, x=0, material="pink"):
        g = self.groups["wall"]
        g.box(x,height/2,depth/2+.014,width+.012,height,.028,material)
        # The stripes are facade siding, with no alpha transparency or textures.
        for j in range(1,int(height/.135)):
            g.box(x,j*.135,depth/2+.031,width+.014,.012,.009,"pink_dark" if material=="pink" else "roof_edge")

    def window(self, x, y, z, width, height, side=False):
        g, d = self.groups["windows"], self.groups["details"]
        f=.038
        if not side:
            g.box(x,y,z,width,height,.018,"window")
            for xx in (x-width/2-f/2,x+width/2+f/2):
                d.box(xx,y,z+.015,f,height+2*f,.032,"frame")
            for yy in (y-height/2-f/2,y+height/2+f/2):
                d.box(x,yy,z+.015,width+2*f,f,.032,"frame")
            d.box(x,y,z+.027,.025,height,.018,"frame")
            d.box(x,y+.08,z+.028,width,.025,.018,"frame")
            d.box(x,y-height/2-.04,z+.045,width+.13,.045,.13,"frame")
        else:
            g.box(x,y,z,.018,height,width,"window")
            for zz in (z-width/2-f/2,z+width/2+f/2):
                d.box(x+.018,y,zz,.032,height+2*f,f,"frame")
            for yy in (y-height/2-f/2,y+height/2+f/2):
                d.box(x+.018,yy,z,.032,f,width+2*f,"frame")
            d.box(x+.023,y,z,.018,height,.025,"frame")

    def door(self,x,z,width=.5,height=1.38):
        g,d = self.groups["door"],self.groups["details"]
        g.box(x,height/2+.06,z,width,height,.06,"door")
        g.box(x,height*.68,z+.034,width*.63,height*.36,.015,"window")
        g.box(x+width*.31,height*.42,z+.056,.04,.065,.04,"yellow")
        for xx in (x-width/2-.03,x+width/2+.03):
            d.box(xx,height/2+.06,z+.015,.05,height+.1,.08,"frame")
        d.box(x,height+.105,z+.015,width+.11,.05,.08,"frame")
        d.box(x,.065,z+.18,width+.3,.13,.38,"step")
        d.box(x,.025,z+.37,width+.52,.05,.2,"step")


def house():
    b=Building("gable_house", [2.66,3.79,3.63])
    b.shell(2.4,3.0,2.1,3.7)
    b.roof(2.4,3.0,2.1,3.7)
    b.cladding(2.4,3.0,1.4)
    b.window(-.73,1.04,1.55,.55,.83)
    b.window(.73,1.04,1.55,.55,.83)
    b.window(0,2.66,1.53,.55,.66)
    b.window(1.22,1.26,-.73,.69,1.0,True)
    b.window(1.22,1.26,.62,.69,1.0,True)
    b.door(0,1.55)
    b.groups["details"].box(-.79,2.29,-.82,.25,.52,.29,"pink_dark")
    return b


def atelier():
    b=Building("twin_atelier", [3.84,3.5,3.74])
    # Twin gables create a more playful silhouette for the motion workshops.
    for x in (-.88,.88):
        b.shell(1.76,3.2,1.98,3.39,x)
        b.roof(1.76,3.2,1.98,3.39,x)
    b.cladding(3.52,3.2,.54,material="lavender")
    for x in (-1.34,-.88,-.42,.42,.88,1.34):
        b.window(x,1.1,1.64,.37,1.05)
    b.window(-.88,2.53,1.63,.4,.56)
    b.window(.88,2.53,1.63,.4,.56)
    b.window(1.78,1.13,-.87,.65,.96,True)
    b.window(1.78,1.13,.49,.65,.96,True)
    b.door(0,1.7,.51,1.36)
    # Pink lintel and a little studio awning are recognisable at the town scale.
    d=b.groups["details"]
    d.box(0,1.83,1.72,3.58,.13,.21,"pink")
    d.box(0,1.62,1.88,1.05,.055,.55,"pink")
    return b


def pavilion():
    b=Building("waterfront_pavilion", [4.46,3.04,3.22])
    b.shell(4.2,2.6,1.72,2.95,front_material="pink")
    b.roof(4.2,2.6,1.72,2.95)
    b.cladding(4.2,2.6,.45)
    for x in (-1.68,-1.12,-.56,.56,1.12,1.68):
        b.window(x,1.02,1.34,.47,1.18)
    b.door(0,1.39,.47,1.45)
    for z in (-.82,0,.82):
        b.window(2.12,1.02,z,.62,1.12,True)
    d=b.groups["details"]
    d.box(0,1.67,1.44,4.3,.09,.3,"frame")
    d.box(0,.045,1.62,4.45,.09,.45,"step")
    return b


def write_glb(building: Building, filename: str):
    binary=bytearray()
    views=[]
    accessors=[]
    meshes=[]
    nodes=[]
    material_names=list(PALETTE)
    materials=[]
    for name,color in PALETTE.items():
        mat={"name":name,"pbrMetallicRoughness":{"baseColorFactor":rgba(color),"metallicFactor":0,"roughnessFactor":.94}}
        if name=="window":
            mat["emissiveFactor"]=[v*.045 for v in rgba(color)[:3]]
        materials.append(mat)

    def accessor(values, component, kind, target, bounds=False):
        while len(binary)%4:binary.append(0)
        offset=len(binary)
        char="f" if component==5126 else "H"
        binary.extend(struct.pack("<"+char*len(values),*values))
        view=len(views)
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(binary)-offset,"target":target})
        size={"SCALAR":1,"VEC3":3}[kind]
        record={"bufferView":view,"byteOffset":0,"componentType":component,"count":len(values)//size,"type":kind}
        if bounds:
            record["min"]=[min(values[i::size]) for i in range(size)]
            record["max"]=[max(values[i::size]) for i in range(size)]
        accessors.append(record)
        return len(accessors)-1

    total_triangles=0
    for name,geometry in building.groups.items():
        primitives=[]
        for material,data in geometry.parts.items():
            if not data["p"]:continue
            pi=accessor(data["p"],5126,"VEC3",34962,True)
            ni=accessor(data["n"],5126,"VEC3",34962)
            ii=accessor(data["i"],5123,"SCALAR",34963)
            total_triangles+=len(data["i"])//3
            primitives.append({"attributes":{"POSITION":pi,"NORMAL":ni},"indices":ii,"material":material_names.index(material),"mode":4})
        if primitives:
            meshes.append({"name":name,"primitives":primitives})
            nodes.append({"name":name,"mesh":len(meshes)-1})
    children=list(range(len(nodes)))
    all_positions=[data['p'] for geometry in building.groups.values() for data in geometry.parts.values()]
    bounds_min=[min(min(p[i::3]) for p in all_positions) for i in range(3)]
    bounds_max=[max(max(p[i::3]) for p in all_positions) for i in range(3)]
    exact_dimensions=[round(bounds_max[i]-bounds_min[i],5) for i in range(3)]
    nodes.append({"name":building.name,"children":children,"extras":{"dimensions":exact_dimensions,"boundsMin":bounds_min,"boundsMax":bounds_max,"front":"+Z","units":"metres"}})
    doc={"asset":{"version":"2.0","generator":"Portfolio Town original procedural assets"},"scene":0,
         "scenes":[{"nodes":[len(nodes)-1]}],"nodes":nodes,"meshes":meshes,"materials":materials,
         "buffers":[{"byteLength":len(binary)}],"bufferViews":views,"accessors":accessors}
    js=json.dumps(doc,separators=(",",":"),ensure_ascii=True).encode("utf-8")
    js+=b" "*((-len(js))%4)
    binary.extend(b"\0"*((-len(binary))%4))
    size=12+8+len(js)+8+len(binary)
    blob=struct.pack("<III",0x46546c67,2,size)+struct.pack("<I4s",len(js),b"JSON")+js+struct.pack("<I4s",len(binary),b"BIN\0")+binary
    path=OUT/filename
    path.write_bytes(blob)
    calls=sum(len(mesh['primitives']) for mesh in meshes)
    print(f"{filename}: {len(blob):,} bytes; {total_triangles} triangles; {len(meshes)} named groups; {calls} draw calls")
    return path


def write_poster():
    # Original vector cover, drawn in the same architectural vocabulary as the models.
    s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" role="img" aria-labelledby="t d">',
       '<title id="t">Estrella Waterfront Town</title><desc id="d">An original pastel waterfront town with pink gabled houses and indigo roofs.</desc>',
       '<defs><linearGradient id="water" x2=".12" y2="1"><stop stop-color="#bfe8e9"/><stop offset="1" stop-color="#514b9b"/></linearGradient><pattern id="dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".6" fill="#fff1ef" opacity=".6"/></pattern></defs>',
       '<path fill="url(#water)" d="M0 0H1600V1000H0z"/>',
       '<path d="M-120 465 1040 70 1625 490 415 945z" fill="#cfc6cd"/>',
       '<path d="m-70 540 1140-385 225 157L180 724z" fill="#e7ccd7"/>',
       '<path d="m-75 552 1170-398 227 160L165 744z" fill="url(#dots)"/>',
       '<path d="m-20 665 1215-411 80 54L68 728z" fill="#e9e1e2"/>']
    # Houses use an axonometric symbol with a slender, steep indigo roof.
    def h(x,y,sc=1,flip=False):
        return f'''<g transform="translate({x} {y}) scale({sc})">
          <path d="m0 65 88-30 65 46-89 32z" fill="#a7a4c7" opacity=".26"/>
          <path d="M0 0 60-21 60 65 0 86z" fill="#e9a4c5"/>
          <path d="m60-21 64 45v86l-64-45z" fill="#fff1ef"/>
          <path d="m0 0 28-78L91-33 60-21z" fill="#fff1ef"/>
          <path d="m28-78 63 45 33 57-64-45z" fill="#494383"/>
          <path d="m0 0 28-78 32 57z" fill="#fff1ef"/>
          <path d="m16 14 14-5v24l-14 5zm24-8 13-5v25l-13 5z" fill="#a9d8e5"/>
          <path d="m22 51 16-6v29l-16 5z" fill="#736999"/>
          <path d="m72 7 18 12v26L72 33zm30 20 12 9v26l-12-9z" fill="#b7dce5"/>
          <g stroke="#fff1ef" stroke-width="1" opacity=".55"><path d="m1 45 58-20m-58 28 58-20m-58 28 58-20m-58 28 58-20"/></g>
        </g>'''
    for i,(x,y,sc) in enumerate([(160,425,1.12),(325,371,1.08),(491,317,1.05),(652,263,1.0),(810,211,.98),(966,160,.94),(1080,400,1.35),(450,555,1.14),(690,480,1.08)]):
        s.append(h(x,y,sc))
    # Fine site-plan linework sits beneath the island as in an architecture board.
    s.append('<g fill="none" stroke="#f9ecf0" opacity=".42" stroke-width="1.5" transform="translate(620 900) rotate(-19) skewX(17)">')
    for i in range(9):
        x=(i%5)*135;y=(i//5)*-125
        s.append(f'<path d="M{x} {y}h100v-80h-35v-22h-65zM{x+12} {y-12}h35v-45h-35zM{x+57} {y-12}h30v-45h-30z"/>')
    s.append('</g>')
    # A few tiny residents, planted trees and boats make the static fallback feel inhabited.
    for i in range(37):
        x=110+(i*109)%1260;y=442+(i*43)%233
        color=['#f7c7d7','#77cbcf','#f8de86','#7b70ae'][i%4]
        s.append(f'<g transform="translate({x} {y})"><circle cy="-12" r="3" fill="#f0c9ad"/><path d="M-3-8h6l2 13H-5z" fill="{color}"/><path d="m-2 5-1 9m5-9 2 9" stroke="#75679a" stroke-width="1.5"/></g>')
    for x,y in [(290,620),(1150,478),(1350,550),(580,450),(985,335)]:
        s.append(f'<g transform="translate({x} {y})"><path d="M0 0v-66m0 23-18-17m18 28 22-19m-22 5 14-22" stroke="#719b47" stroke-width="3"/><circle cy="-70" r="11" fill="#91b76b"/><circle cx="-15" cy="-51" r="11" fill="#a6c676"/><circle cx="16" cy="-37" r="13" fill="#8eb561"/></g>')
    s.append('<g transform="translate(1370 730)"><path d="M-18 11h50l-6 7h-39z" fill="#efc0d3"/><path d="M2 7V-79L30 7z" fill="#ffe6a0"/><path d="M-1-61-20 7H-1z" fill="#fff1ef"/></g>')
    s.append('<g fill="none" stroke="#fff1ef" opacity=".45"><path d="M1270 770q80 20 170-7M55 852q90 20 180-9M1150 100q70 15 145-8"/></g>')
    s.append('</svg>')
    (OUT/'town-poster.svg').write_text('\n'.join(s),encoding='utf-8')
    print('town-poster.svg: original fallback poster')


def validate(path: Path):
    blob=path.read_bytes()
    magic,version,total=struct.unpack_from('<III',blob)
    assert magic==0x46546c67 and version==2 and total==len(blob)
    jsonlen,tag=struct.unpack_from('<I4s',blob,12)
    assert tag==b'JSON'
    doc=json.loads(blob[20:20+jsonlen])
    binoff=20+jsonlen
    binlen,bintag=struct.unpack_from('<I4s',blob,binoff)
    assert bintag==b'BIN\0' and binoff+8+binlen==len(blob)
    for view in doc['bufferViews']:
        assert view['byteOffset']%4==0
        assert view['byteOffset']+view['byteLength']<=binlen
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            indices=doc['accessors'][prim['indices']]
            positions=doc['accessors'][prim['attributes']['POSITION']]
            view=doc['bufferViews'][indices['bufferView']]
            vals=struct.unpack_from('<'+'H'*indices['count'],blob,binoff+8+view['byteOffset'])
            assert max(vals)<positions['count']
    print(f'validated {path.name}')


def write_grain():
    """KTX2, 64x64 RGBA8 UNORM, a complete mip chain, valid basic DFD.

    This intentionally uses uncompressed VK_FORMAT_R8G8B8A8_UNORM (37).
    Its 22 KB file needs no Basis/WASM transcode and is suitable as a very
    subtle repeating rough paper multiplier, rather than a colour photograph.
    """
    rng=random.Random(83)
    size=64
    source=[]
    for y in range(size):
        row=[]
        for x in range(size):
            # Fine weave plus seeded grain; keep the multiplier close to white.
            v=round(max(216,min(255,242+rng.gauss(0,5)+(x%3==0)*3-(y%4==0)*3)))
            row.append((v,v,v,255))
        source.append(row)
    mip_data=[]
    while True:
        mip_data.append(bytes(c for row in source for pixel in row for c in pixel))
        if size==1:break
        nxt=[]
        for y in range(size//2):
            row=[]
            for x in range(size//2):
                pixels=[source[y*2+dy][x*2+dx] for dy in (0,1) for dx in (0,1)]
                row.append(tuple(round(sum(a[ch] for a in pixels)/4) for ch in range(4)))
            nxt.append(row)
        source=nxt;size//=2
    levels=len(mip_data)
    dfd_offset=80+levels*24
    descriptor_block_size=24+4*16
    # Khronos basic data-format descriptor version 2; RGBSDA / BT.709 / linear.
    dfd=struct.pack('<IHHHH4B4B8B',4+descriptor_block_size,0,0,2,descriptor_block_size,
                    1,1,1,0,0,0,0,0,4,0,0,0,0,0,0,0)
    for bit_offset,channel in ((0,0),(8,1),(16,2),(24,15)):
        dfd+=struct.pack('<HBB4BII',bit_offset,7,channel,0,0,0,0,0,255)
    assert len(dfd)==92
    payload_start=(dfd_offset+len(dfd)+7)//8*8
    data=bytearray()
    locations={}
    for level in reversed(range(levels)):
        while (payload_start+len(data))%8:data.append(0)
        locations[level]=payload_start+len(data)
        data.extend(mip_data[level])
    identifier=b'\xabKTX 20\xbb\r\n\x1a\n'
    header=identifier+struct.pack('<9I4I2Q',37,1,64,64,0,0,1,levels,0,
                                 dfd_offset,len(dfd),0,0,0,0)
    assert len(header)==80
    index=b''.join(struct.pack('<QQQ',locations[i],len(mip_data[i]),len(mip_data[i])) for i in range(levels))
    blob=header+index+dfd+b'\0'*(payload_start-dfd_offset-len(dfd))+data
    path=OUT/'paper-grain.ktx2'
    path.write_bytes(blob)
    assert len(blob)==max(locations[i]+len(mip_data[i]) for i in range(levels))
    for i in range(levels):
        assert locations[i]%8==0
        assert len(mip_data[i])==max(1,64>>i)**2*4
    print(f'paper-grain.ktx2: {len(blob):,} bytes; 64x64 RGBA8 UNORM; {levels} mip levels; validated header / DFD / ranges')


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for model,name in ((house(),'gable-house.glb'),(atelier(),'atelier.glb'),(pavilion(),'pavilion.glb')):
        validate(write_glb(model,name))
    write_poster()
    write_grain()
