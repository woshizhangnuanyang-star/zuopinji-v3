"""Original pastel European town assets, created without downloaded artwork.

Run: python scripts/build_journey_assets.py
Y=0 is ground. Facades face +Z. Scenery uses one vertex-coloured primitive per
building type. The café keeps separate parts and pivots for interactions.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import struct
from build_assets import Geometry, linear

OUT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'journey'
CREAM='#fff0f5'  # Historic helper name; all frames now use pink-white.
CREAM_LIGHT='#fff0f5'
GLASS='#b9e5e7'
GLASS_DARK='#4b438a'
BLUE='#b9e5e7'
MINT='#96ced0'
ROSE='#edb8d3'
LILAC='#b6a3d4'
OCHRE='#8472b3'
ROOF='#4b438a'
PINK='#edb8d3'
BRICK='#cf93bb'
GREEN='#6da4a1'


def rgb(hexcode):
    # glTF COLOR_0 is linear. Never write sRGB bytes directly into this stream.
    return [linear(int(hexcode[i:i+2],16)/255) for i in (1,3,5)]


def mapper(axis,cx,cy,cz):
    if axis=='right':return lambda x,y,z:(cx+z,cy+y,cz-x)
    if axis=='left':return lambda x,y,z:(cx-z,cy+y,cz+x)
    return lambda x,y,z:(cx+x,cy+y,cz+z)


def box(g,cx,cy,cz,w,h,d,color,axis='front'):
    temp=Geometry()
    temp.box(0,0,0,w,h,d,color)
    transform=mapper(axis,cx,cy,cz)
    # Every source box face has exactly four unique vertices.
    points=temp.parts[color]['p']
    for i in range(0,len(points),12):
        g.face([transform(*points[j:j+3]) for j in range(i,i+12,3)],color)


def polygon(g,points,z,color,transform=None):
    tx=transform or (lambda x,y,z:(x,y,z))
    g.face([tx(x,y,z) for x,y in points],color)


def ring(g,outer,inner,z,color,tx=None):
    tx=tx or (lambda x,y,z:(x,y,z))
    for i in range(len(outer)):
        j=(i+1)%len(outer)
        g.face([tx(*outer[i],z),tx(*outer[j],z),tx(*inner[j],z),tx(*inner[i],z)],color)


def arch_contour(w,h,bottom=0,n=12):
    r=w/2;cy=bottom+h-r
    return [(-r,bottom),(r,bottom)]+[(math.cos(i*math.pi/n)*r,cy+math.sin(i*math.pi/n)*r) for i in range(n+1)]


class House:
    def __init__(self,name,w=2.6,d=2.6,h=3.2,color=BLUE):
        self.name,self.w,self.d,self.h,self.color=name,w,d,h,color
        self.g={n:Geometry() for n in ('wall','roof','windows','door','details')}
        self.pivots={}
        self.extras={}

    def shell(self,door_gap=None):
        w,d,h=self.w,self.d,self.h
        g=self.g['wall']
        # Hollow architecture rather than a solid cuboid: opening the door
        # reveals a real recess, and the front jambs retain their thickness.
        box(g,0,h/2,-d/2+.06,w,h,.12,self.color)
        box(g,-w/2+.06,h/2,0,.12,h,d,self.color)
        box(g,w/2-.06,h/2,0,.12,h,d,self.color)
        if door_gap:
            x,dw,dh=door_gap
            left=x-dw/2;right=x+dw/2
            if left>-w/2:box(g,(-w/2+left)/2,h/2,d/2-.05,left+w/2,h,.1,self.color)
            if right<w/2:box(g,(right+w/2)/2,h/2,d/2-.05,w/2-right,h,.1,self.color)
            box(g,x,(dh+h)/2,d/2-.05,dw,h-dh,.1,self.color)
        else:box(g,0,h/2,d/2-.05,w,h,.1,self.color)
        box(g,0,.045,0,w,.09,d,'#b6a3d4')

    def floor_band(self,y,height=.1,color=CREAM,overhang=.06):
        w,d=self.w+overhang*2,self.d+overhang*2
        g=self.g['details']
        box(g,0,y,d/2,w,height,.1,color)
        box(g,0,y,-d/2,w,height,.1,color)
        box(g,-w/2,y,0,.1,height,d,color)
        box(g,w/2,y,0,.1,height,d,color)

    def pitched(self,eave,peak,color=CREAM,x=0,width=None,depth=None,facade=True):
        w=width or self.w;d=depth or self.d
        g=self.g['roof'];a=w/2+.09;b=d/2+.09
        g.face([(x-a,eave,b),(x,peak,b),(x,peak,-b),(x-a,eave,-b)],color)
        g.face([(x,peak,b),(x+a,eave,b),(x+a,eave,-b),(x,peak,-b)],color)
        edge='#6e65a7' if color==CREAM else '#6e65a7'
        # Narrow bands define individual rows of pastel roof tiles.
        for k in range(1,9):
            off=a*k/9;stripe=.012
            for side in (-1,1):
                q0,q1=side*(off-stripe),side*(off+stripe)
                y0=peak-abs(q0)/a*(peak-eave)+.004
                y1=peak-abs(q1)/a*(peak-eave)+.004
                if side<0:g.face([(x+q1,y1,b),(x+q0,y0,b),(x+q0,y0,-b),(x+q1,y1,-b)],edge)
                else:g.face([(x+q0,y0,b),(x+q1,y1,b),(x+q1,y1,-b),(x+q0,y0,-b)],edge)
        for z in (-d/2-.002,d/2+.002):
            # Gable ends and two cream barge boards on the street-facing end.
            if facade:
                pts=[(x-w/2,eave,z),(x+w/2,eave,z),(x,peak-.03,z)]
                if z<0:pts.reverse()
                self.g['wall'].face(pts,self.color)
        for side in (-1,1):
            xx=x+side*a
            g.face([(xx,eave-.065,b+.01),(x,peak-.065,b+.01),(x,peak+.005,b+.01),(xx,eave+.005,b+.01)] if side<0 else
                   [(x,peak-.065,b+.01),(xx,eave-.065,b+.01),(xx,eave+.005,b+.01),(x,peak+.005,b+.01)],CREAM_LIGHT)
        box(g,x,peak,0,.045,.055,2*b,edge)

    def rect_window(self,x,y,width=.6,height=1.0,z=None,axis='front',frame=CREAM,glass=GLASS,mullions=True):
        z=self.d/2+.02 if z is None else z
        tx=mapper(axis,x,y,z)
        wg,dg=self.g['windows'],self.g['details']
        polygon(wg,[(-width/2,-height/2),(width/2,-height/2),(width/2,height/2),(-width/2,height/2)],.006,glass,tx)
        f=.045
        for a in (-1,1):box(dg,x+a*(width+f)/2,y,z+.035,f,height+.09,.065,frame) if axis=='front' else None
        if axis!='front':
            # Locally oriented boxes keep side-window trim facing outwards.
            for a in (-1,1):
                for coords in ((a*(width+f)/2,0,.035,f,height+.09,.065),(0,a*(height+f)/2,.035,width+.09,f,.065)):
                    q=tx(*coords[:3]);box(dg,*q,*coords[3:],frame,axis=axis)
        else:
            for a in (-1,1):box(dg,x,y+a*(height+f)/2,z+.035,width+.09,f,.065,frame)
        if mullions:
            q=tx(0,0,.055);box(dg,*q,.027,height,.025,frame,axis=axis)
            q=tx(0,.1,.056);box(dg,*q,width,.027,.025,frame,axis=axis)
        q=tx(0,-height/2-.065,.065);box(dg,*q,width+.16,.06,.16,frame,axis=axis)

    def arch_window(self,x,bottom,width=.62,height=1.02,z=None,axis='front',frame=CREAM,glass=GLASS):
        z=self.d/2+.025 if z is None else z
        tx=mapper(axis,x,bottom,z)
        inner=arch_contour(width,height,n=10)
        outer=arch_contour(width+.11,height+.11,bottom=-.055,n=10)
        polygon(self.g['windows'],inner,.006,glass,tx)
        ring(self.g['details'],outer,inner,.055,frame,tx)
        q=tx(0,(height-width/2)/2,.065);box(self.g['details'],*q,.026,height-width/2,.022,frame,axis=axis)
        q=tx(0,height-width/2,.065);box(self.g['details'],*q,width,.026,.022,frame,axis=axis)
        q=tx(0,-.075,.08);box(self.g['details'],*q,width+.17,.065,.17,frame,axis=axis)

    def front_door(self,x=0,width=.68,height=1.65,color='#4b438a',arched=False,z=None,frame=CREAM):
        z=self.d/2+.035 if z is None else z
        g=self.g['door'];dg=self.g['details']
        if arched:
            inner=arch_contour(width,height,n=10)
            outer=arch_contour(width+.14,height+.1,bottom=0,n=10)
            polygon(g,[(a+x,b) for a,b in inner],z+.006,color)
            ring(dg,[(a+x,b) for a,b in outer],[(a+x,b) for a,b in inner],z+.055,frame)
        else:
            box(g,x,height/2,z,width,height,.065,color)
            for side in (-1,1):box(dg,x+side*(width+.075)/2,(height+.05)/2,z+.015,.075,height+.05,.105,frame)
            box(dg,x,height+.035,z+.015,width+.15,.07,.105,frame)
        # A glazed top panel and a lower inset panel are part of the moving door.
        box(g,x,height*.66,z+.045,width*.67,height*.39,.018,GLASS_DARK)
        box(g,x,height*.23,z+.045,width*.68,height*.22,.018,CREAM if color==CREAM else color)
        for sign in (-1,1):box(g,x+sign*width*.345,height*.23,z+.058,.016,height*.23,.014,frame)
        box(g,x+width*.29,height*.44,z+.095,.035,.065,.045,'#6e65a7')
        box(dg,x,.05,z+.17,width+.28,.1,.38,'#fff0f5')
        self.pivots['door']=[x-width/2,0,z]
        self.extras['doorCenter']=[x,height/2,z]
        self.extras['doorThreshold']=[x,0,z+.2]

    def balcony(self,y,width=1.95,x=0,projection=.36,color=CREAM):
        z=self.d/2
        g=self.g['details'];end=z+projection
        box(g,x,y,z+projection/2,width,.085,projection+.12,color)
        box(g,x,y+.49,end,width,.04,.04,color)
        box(g,x,y+.13,end,width,.032,.035,color)
        for j in range(9):box(g,x-width*.47+j*width*.94/8,y+.29,end,.024,.43,.025,color)
        for sign in (-1,1):
            xx=x+sign*width*.49
            box(g,xx,y+.49,z+projection/2,.035,.035,projection,color)
            box(g,xx,y+.28,z+projection*.4,.025,.4,.025,color)
        # Two supporting corbels read well under side lighting.
        for sign in (-1,1):box(g,x+sign*width*.34,y-.12,z+.10,.09,.2,.2,color)

    def side_windows(self,levels=(.9,2.4),width=.55,height=.85,arched=False):
        for side in (-1,1):
            axis='right' if side==1 else 'left';sx=side*(self.w/2+.025)
            for y in levels:
                for zz in (-.63,.61):
                    if arched:self.arch_window(sx,y-height/2,width,height,zz,axis=axis)
                    else:self.rect_window(sx,y,width,height,zz,axis=axis)

    def brick_base(self,height=.9):
        for row in range(6):
            y=.08+row*height/6
            for j in range(7):
                x=-self.w/2+(j+.5+(.45 if row%2 else 0))*self.w/7
                if x>self.w/2-.03:continue
                box(self.g['details'],x,y,self.d/2+.014,self.w/7-.025,height/6-.022,.018,BRICK)
        for side in (-1,1):
            for row in range(6):
                for j in range(5):
                    z=-self.d/2+(j+.5+(.45 if row%2 else 0))*self.d/5
                    if z>self.d/2-.04:continue
                    box(self.g['details'],side*(self.w/2+.01),.08+row*height/6,z,.02,height/6-.022,self.d/5-.026,BRICK)

    def chimney(self,x=.65,z=-.65,top=4.55,color=None):
        color=color or self.color;g=self.g['roof']
        box(g,x,top-.35,z,.25,.7,.31,color)
        box(g,x,top+.015,z,.34,.08,.39,CREAM)
        box(g,x,top+.058,z,.18,.012,.23,'#4b438a')


def blue_gable():
    h=House('blue-gable',2.6,2.6,3.10,'#82bdcf');h.shell()
    # Unequal curling eaves and a shifted ridge, rather than a repeated triangle.
    profile=[(-1.61,3.25),(-1.43,3.17),(-1.16,3.35),(-.83,3.82),(-.39,4.50),(-.19,4.58),(.10,4.48),(.43,4.15),(.81,3.65),(1.23,3.35),(1.58,3.42)]
    for (x0,y0),(x1,y1) in zip(profile,profile[1:]):
        h.g['roof'].face([(x0,y0,1.41),(x1,y1,1.41),(x1,y1,-1.41),(x0,y0,-1.41)],ROOF)
        h.g['wall'].face([(x0,3.10,1.303),(x1,3.10,1.303),(x1,y1,1.303),(x0,y0,1.303)],h.color)
        h.g['wall'].face([(x1,3.10,-1.303),(x0,3.10,-1.303),(x0,y0,-1.303),(x1,y1,-1.303)],h.color)
        h.g['details'].face([(x0,y0-.065,1.425),(x1,y1-.065,1.425),(x1,y1+.012,1.425),(x0,y0+.012,1.425)],CREAM)
    # Wood-board facade and visible side boarding, all behind window glass.
    for j in range(21):
        yy=.10+j*.145
        polygon(h.g['details'],[(-1.29,yy),(1.29,yy),(1.29,yy+.014),(-1.29,yy+.014)],1.312,'#a2d7dc')
        for side in (-1,1):box(h.g['details'],side*1.306,yy,0,.012,.014,2.57,'#a2d7dc')
    box(h.g['roof'],.72,4.35,-.61,.30,1.70,.36,PINK)
    box(h.g['roof'],.72,5.235,-.61,.42,.10,.48,CREAM)
    box(h.g['roof'],.72,5.291,-.61,.24,.012,.29,ROOF)
    h.floor_band(.22,.09);h.floor_band(1.83,.08)
    h.arch_window(-.65,1.99,.62,1.00);h.arch_window(.65,1.99,.62,1.00)
    h.rect_window(-.62,.92,.72,1.13);h.front_door(.65,.7,1.64,'#b9e5e7')
    h.arch_window(0,3.55,.45,.59)
    h.balcony(1.92,2.05,color=CREAM_LIGHT);h.side_windows((.93,2.55),.59,.96,True)
    return h


def lattice(h,x,y,z,width,height,spacing=.29,color=CREAM):
    """Clipped diagonal ribbons make a real diamond-pattern shop window."""
    for slope in (-1.6,1.6):
        span=height/2+abs(slope)*width/2
        count=math.ceil(span*2/spacing)
        for i in range(count+1):
            b=-span+i*spacing;pts=[]
            for xx in (-width/2,width/2):
                yy=slope*xx+b
                if -height/2-1e-6<=yy<=height/2+1e-6:pts.append((xx,yy))
            for yy in (-height/2,height/2):
                xx=(yy-b)/slope
                if -width/2-1e-6<=xx<=width/2+1e-6:pts.append((xx,yy))
            if len(pts)<2:continue
            a,c=max(((a,c) for a in pts for c in pts),key=lambda q:(q[0][0]-q[1][0])**2+(q[0][1]-q[1][1])**2)
            dx,dy=c[0]-a[0],c[1]-a[1];length=math.hypot(dx,dy)
            if length<.03:continue
            px,py=-dy/length*.009,dx/length*.009
            polygon(h.g['details'],[(x+a[0]+px,y+a[1]+py),(x+a[0]-px,y+a[1]-py),(x+c[0]-px,y+c[1]-py),(x+c[0]+px,y+c[1]+py)],z,color)


def mint_twin():
    h=House('mint-twin',2.8,2.6,3.0,'#96ced0');h.shell();h.brick_base(.94)
    for x in (-.7,.7):h.pitched(3.0,4.06,'#4b438a',x=x,width=1.4)
    h.floor_band(1.9,.10);h.floor_band(.16,.1)
    for x in (-.94,.94):h.arch_window(x,2.1,.56,.77)
    h.rect_window(0,2.52,.55,.78);h.front_door(-.65,.78,1.76,'#4b438a',True)
    h.arch_window(.68,.44,.72,1.02)
    h.side_windows((.95,2.42),.58,.85)
    return h


def rose_arch():
    h=House('rose-arch',2.6,2.6,3.03,'#edb8d3');h.shell();h.pitched(3.0,4.14,'#4b438a',facade=False)
    # Curved Dutch-gable silhouette is built as a strip under a sampled crown.
    left=[(-1.30,3.0),(-1.27,3.14),(-1.16,3.19),(-1.03,3.22),(-.91,3.29),(-.86,3.43),(-.83,3.62),(-.73,3.73),(-.57,3.80),(-.47,3.91),(-.42,4.09),(-.29,4.24),(0,4.32)]
    profile=left+[(-x,y) for x,y in reversed(left[:-1])]
    for (x0,y0),(x1,y1) in zip(profile,profile[1:]):
        h.g['wall'].face([(x0,3.0,1.34),(x1,3.0,1.34),(x1,y1,1.34),(x0,y0,1.34)],h.color)
        h.g['details'].face([(x0,y0-.055,1.37),(x1,y1-.055,1.37),(x1,y1+.018,1.37),(x0,y0+.018,1.37)],CREAM)
    h.floor_band(1.87,.08);h.floor_band(.18,.08)
    h.arch_window(-.66,2.02,.64,.91);h.arch_window(.66,2.02,.64,.91)
    h.arch_window(-.76,.42,.48,1.05);h.arch_window(.76,.42,.48,1.05)
    h.front_door(0,.68,1.76,'#6da4a1',True)
    # Circular gable window, with an uninterrupted cream ring.
    outer=[(math.cos(i*math.tau/20)*.265,3.66+math.sin(i*math.tau/20)*.265) for i in range(20)]
    inner=[(x*.78,3.66+(y-3.66)*.78) for x,y in outer]
    polygon(h.g['windows'],inner,1.39,GLASS_DARK);ring(h.g['details'],outer,inner,1.41,CREAM)
    h.side_windows((.94,2.44),.56,.86,True)
    return h


def ochre_mansard():
    h=House('ochre-mansard',2.7,2.6,2.87,'#8472b3');h.shell();h.floor_band(.19,.10);h.floor_band(1.72,.10)
    g=h.g['roof'];a=1.46;b=1.41;u=.83;v=.78;lo=2.9;hi=4.02
    corners=[(-a,b),(a,b),(a,-b),(-a,-b)]
    tops=[(-u,v),(u,v),(u,-v),(-u,-v)]
    for i in range(4):
        j=(i+1)%4
        g.face([(corners[i][0],lo,corners[i][1]),(corners[j][0],lo,corners[j][1]),(tops[j][0],hi,tops[j][1]),(tops[i][0],hi,tops[i][1])],'#4b438a')
        g.face([(tops[i][0],hi,tops[i][1]),(tops[j][0],hi,tops[j][1]),(0,4.33,0)],'#6e65a7')
    h.floor_band(2.88,.11,CREAM,.11)
    for x in (-.67,.67):
        h.rect_window(x,2.2,.63,1.02)
        # Two projecting dormers break the steep mansard plane.
        box(h.g['wall'],x,3.49,1.0,.54,.64,.46,h.color)
        h.rect_window(x,3.5,.39,.5,1.25)
        rg=h.g['roof'];z0=.74;z1=1.31
        rg.face([(x-.35,3.82,z1),(x,4.05,z1),(x,4.05,z0),(x-.35,3.82,z0)],CREAM)
        rg.face([(x,4.05,z1),(x+.35,3.82,z1),(x+.35,3.82,z0),(x,4.05,z0)],CREAM)
    h.arch_window(-.67,.42,.66,.98);h.front_door(.67,.7,1.62,'#4b438a')
    h.side_windows((.92,2.22),.57,.88)
    return h


def lilac_balcony():
    h=House('lilac-balcony',2.7,2.6,3.67,'#b6a3d4');h.shell();h.pitched(3.65,4.54,'#4b438a')
    h.floor_band(.17,.1);h.floor_band(1.27,.075);h.floor_band(2.51,.075)
    for y in (1.86,3.05):
        for x in (-.66,.66):h.rect_window(x,y,.64,.96)
    h.front_door(.68,.65,1.17,'#6e65a7');h.rect_window(-.65,.68,.76,.91)
    h.balcony(1.31,2.35,projection=.38,color=CREAM_LIGHT);h.balcony(2.55,2.35,projection=.38,color=CREAM_LIGHT)
    h.chimney(.65,-.55,4.66,'#6e65a7');h.side_windows((.73,1.93,3.09),.49,.76)
    return h


def gallery_flat():
    h=House('gallery-flat',2.9,2.6,3.36,'#fff0f5');h.shell((-.92,.8,2.3));h.floor_band(.18,.11,'#b6a3d4')
    h.floor_band(3.25,.15,CREAM_LIGHT,.1)
    box(h.g['roof'],0,3.38,0,3.03,.13,2.73,'#4b438a')
    for side in (-1,1):box(h.g['roof'],side*1.46,3.56,0,.09,.28,2.73,CREAM)
    box(h.g['roof'],0,3.56,-1.32,2.95,.28,.09,CREAM)
    box(h.g['roof'],0,3.56,1.32,2.95,.28,.09,CREAM)
    h.front_door(-.92,.8,2.3,'#96ced0',z=1.37)
    h.rect_window(.61,1.5,1.63,1.95,1.34,frame='#b6a3d4',glass='#b9e5e7',mullions=False)
    # Original abstract art is visible in the gallery display, with no text.
    box(h.g['details'],.23,1.60,1.385,.39,.76,.014,'#f2e999')
    box(h.g['details'],.81,1.61,1.387,.46,.90,.014,'#edb8d3')
    box(h.g['details'],.81,1.77,1.398,.24,.34,.008,'#fff0f5')
    h.side_windows((1.38,2.67),.70,.79)
    return h


def cylinder(g,cx,cy,cz,r0,r1,height,color,n=10):
    bottom=[(cx+math.cos(i*math.tau/n)*r0,cy,cz+math.sin(i*math.tau/n)*r0) for i in range(n)]
    top=[(cx+math.cos(i*math.tau/n)*r1,cy+height,cz+math.sin(i*math.tau/n)*r1) for i in range(n)]
    for i in range(n):
        j=(i+1)%n
        g.face([bottom[j],bottom[i],top[i],top[j]],color)
    g.face(bottom,color);g.face(list(reversed(top)),color)


def bud(g,x,y,z,rx,ry,rz,color):
    p=[(x+rx,y,z),(x,y,z+rz),(x-rx,y,z),(x,y,z-rz)]
    for i in range(4):
        j=(i+1)%4
        g.face([(x,y+ry,z),p[j],p[i]],color)
        g.face([(x,y-ry,z),p[i],p[j]],color)


def flowerpot(h,x,z):
    g=h.g['details']
    cylinder(g,x,0,z,.14,.21,.36,'#b6a3d4',8)
    cylinder(g,x,.315,z,.22,.22,.065,'#edb8d3',8)
    cylinder(g,x,.37,z,.17,.17,.012,'#4b438a',8)
    for i in range(7):
        angle=i*2.4
        xx=x+math.cos(angle)*(.10+i%2*.025);zz=z+math.sin(angle)*.105
        yy=.53+(i%3)*.085
        g.face([(xx-.008,.37,zz),(xx+.008,.37,zz),(xx+.008,yy,zz),(xx-.008,yy,zz)],GREEN)
        bud(g,xx,yy-.08,zz,.06,.08,.033,'#6da4a1')
        bud(g,xx,yy,zz,.065,.055,.065,['#edb8d3','#f2e999','#fff0f5'][i%3])


def rose_cafe():
    h=House('rose-cafe',4.4,3.0,4.86,'#edb8d3')
    h.g['blinds']=Geometry();h.g['awning']=Geometry()
    h.pivots['blinds']=[0,4.30,1.60]
    h.pivots['awning']=[0,2.72,1.53]
    h.shell((-1.35,.90,2.40))
    # Strong, layered horizontal cornices retain the illustrated photo's form.
    for y,height,color,overhang in ((.18,.14,'#cf8fb9',.035),(2.72,.10,CREAM,.045),(2.85,.065,'#d69bc5',.035),(4.79,.10,CREAM,.065)):
        h.floor_band(y,height,color,overhang)
    # Offset indigo pitched roof stays inside the original 5.4-high envelope.
    roof_profile=[(-2.31,4.88),(-.48,5.40),(2.31,4.94)]
    for (x0,y0),(x1,y1) in zip(roof_profile,roof_profile[1:]):
        h.g['roof'].face([(x0,y0,1.65),(x1,y1,1.65),(x1,y1,-1.65),(x0,y0,-1.65)],ROOF)
        h.g['wall'].face([(x0,4.86,1.505),(x1,4.86,1.505),(x1,y1,1.505),(x0,y0,1.505)],h.color)
        h.g['wall'].face([(x1,4.86,-1.505),(x0,4.86,-1.505),(x0,y0,-1.505),(x1,y1,-1.505)],h.color)
        h.g['roof'].face([(x0,y0-.045,1.65),(x1,y1-.045,1.65),(x1,y1,1.65),(x0,y0,1.65)],'#6f65a9')
    # Three windows with pink-white frames, lilac shutters and diamond glazing.
    for x in (-1.35,0,1.35):
        h.rect_window(x,3.65,.70,1.28,1.54,frame=CREAM,glass='#abd7e4',mullions=False)
        lattice(h,x,3.65,1.603,.68,1.26,.29)
        for sign in (-1,1):
            sx=x+sign*.535
            box(h.g['blinds'],sx,3.65,1.564,.27,1.30,.046,'#b6a3d4')
            for j in range(7):
                yy=3.12+j*.17
                polygon(h.g['blinds'],[(sx-.1175,yy-.0275),(sx+.1175,yy-.0275),(sx+.1175,yy+.0275),(sx-.1175,yy+.0275)],1.612,'#fff0f5')
            polygon(h.g['blinds'],[(sx-.0175,3.01),(sx+.0175,3.01),(sx+.0175,4.29),(sx-.0175,4.29)],1.626,'#fff0f5')
    # The yellow doorway has a real hole in the shell and a left hinge pivot.
    h.front_door(-1.35,.9,2.4,'#f2e999',False,z=1.555,frame=CREAM)
    # Cafe door panel: thin cream mouldings around the lower inset.
    for y in (.30,.76):box(h.g['door'],-1.35,y,1.618,.64,.025,.012,'#fff0f5')
    box(h.g['door'],-1.35,1.64,1.62,.024,.94,.014,'#fff0f5')
    # Wide right-hand display window and a shallow marble sill.
    h.rect_window(.67,1.35,2.31,1.91,1.545,frame='#fff0f5',glass='#b9e5e7',mullions=False)
    lattice(h,.67,1.35,1.635,2.28,1.88,.48)
    box(h.g['details'],.67,.33,1.63,2.48,.15,.22,'#fff0f5')
    # Two levels of shelves and a few quiet, abstract display objects.
    for y in (.83,1.52):box(h.g['details'],.67,y,1.582,2.12,.045,.035,'#fff0f5')
    for x,y,c in ((-.13,1.02,'#f2e999'),(.37,1.02,'#edb8d3'),(.98,1.02,'#b9e5e7'),(1.47,1.02,'#fff0f5'),(.12,1.69,'#edb8d3'),(.87,1.69,'#fff0f5')):
        bud(h.g['details'],x,y,1.608,.12,.13,.018,c)
    # Curved canvas canopy: alternating soft pink and pale yellow stripes.
    aw=h.g['awning'];aw_width=4.16;n=16;z0=1.53;z1=2.36
    for j in range(n):
        x0=-aw_width/2+j*aw_width/n;x1=-aw_width/2+(j+1)*aw_width/n
        col='#fff0f5' if j%2==0 else '#edb8d3'
        for k in range(6):
            t0=k/6;t1=(k+1)/6
            zz0=z0+(z1-z0)*t0;zz1=z0+(z1-z0)*t1
            yy0=2.72-.32*t0*t0;yy1=2.72-.32*t1*t1
            aw.face([(x0,yy0,zz0),(x0,yy1,zz1),(x1,yy1,zz1),(x1,yy0,zz0)],col)
        aw.face([(x0,2.18,z1+.008),(x1,2.18,z1+.008),(x1,2.40,z1+.008),(x0,2.40,z1+.008)],col)
    # White lace valance: a continuous band and 34 scalloped drops with eyelets.
    box(aw,0,2.205,z1+.016,4.18,.055,.014,'#fff0f5')
    box(aw,0,2.205,2.387,4.18,.012,.008,'#fff0f5')
    for j in range(34):
        center=-2.09+(j+.5)*4.18/34;r=4.18/34/2
        # Four-segment scallops preserve the lace silhouette with few triangles.
        contour=[(center+math.cos(math.pi-i*math.pi/4)*r,2.205-math.sin(math.pi-i*math.pi/4)*.10) for i in range(5)]
        polygon(aw,contour,z1+.028,'#fff0f5')
    # A physical indigo shop plaque above the canopy, with original cup relief.
    box(h.g['details'],1.68,2.97,1.59,.74,.30,.09,ROOF)
    box(h.g['details'],1.68,2.97,1.643,.58,.19,.012,CREAM)
    polygon(h.g['details'],[(1.57,2.92),(1.75,2.92),(1.78,3.01),(1.54,3.01)],1.653,PINK)
    polygon(h.g['details'],[(1.54,2.89),(1.79,2.89),(1.79,2.91),(1.54,2.91)],1.653,ROOF)
    # Thin side arms anchor the canopy to the wall.
    for x in (-2.07,2.07):
        aw.face([(x-.017,2.71,1.54),(x-.017,2.39,2.36),(x+.017,2.39,2.36),(x+.017,2.71,1.54)],'#fff0f5')
    # Side windows on both storeys avoid blank facades in close-up orbit views.
    for side in (-1,1):
        for yy in (1.22,3.67):
            h.rect_window(side*(h.w/2+.025),yy,.84,1.20,0,axis='right' if side==1 else 'left')
    flowerpot(h,-2.04,1.88);flowerpot(h,-.60,1.88)
    h.extras.update({'doorHeight':2.4,'facadeZ':1.55,'doorCenter':[-1.35,1.2,1.555],
                     'doorThreshold':[-1.35,0,1.85],'doorHinge':[-1.8,0,1.555],
                     'awningPivot':[0,2.72,1.53],'blindsPivot':[0,4.30,1.60],
                     'awningFrontZ':2.36,'windowCenters':[[-1.35,3.65,1.54],[0,3.65,1.54],[1.35,3.65,1.54]]})
    return h


def write_glb(h):
    payload=bytearray();views=[];accessors=[];meshes=[];nodes=[];materials=[]
    world_positions=[];triangles=0
    def accessor(values,component,kind,target,bounds=False,normalized=False):
        while len(payload)%4:payload.append(0)
        off=len(payload);code={5126:'f',5123:'H',5121:'B'}[component]
        payload.extend(struct.pack('<'+code*len(values),*values))
        views.append({'buffer':0,'byteOffset':off,'byteLength':len(payload)-off,'target':target})
        dim={'SCALAR':1,'VEC3':3}[kind]
        a={'bufferView':len(views)-1,'byteOffset':0,'componentType':component,'count':len(values)//dim,'type':kind}
        if normalized:a['normalized']=True
        if bounds:
            a['min']=[min(values[i::dim]) for i in range(dim)];a['max']=[max(values[i::dim]) for i in range(dim)]
        accessors.append(a);return len(accessors)-1
    interactive = h.name == 'rose-cafe'
    batches = [(name, g.parts.items(), h.pivots.get(name, [0,0,0])) for name, g in h.g.items()]
    if not interactive:
        batches = [('scenery', [part for _, parts, _ in batches for part in parts], [0,0,0])]
    for name,parts,pivot in batches:
        positions=[];normals=[];indices=[];colors=[]
        for color,data in parts:
            start=len(positions)//3
            for i in range(0,len(data['p']),3):
                pos=data['p'][i:i+3];world_positions.append(pos)
                positions.extend(pos[j]-pivot[j] for j in range(3))
            if interactive:normals.extend(data['n'])
            indices.extend(i+start for i in data['i'])
            color_bytes=[round(min(1,max(0,x))*255) for x in rgb(color)]
            colors.extend(color_bytes*(len(data['p'])//3))
        if not positions:continue
        triangles+=len(indices)//3
        attrs={'POSITION':accessor(positions,5126,'VEC3',34962,True)}
        if interactive:attrs['NORMAL']=accessor(normals,5126,'VEC3',34962)
        attrs['COLOR_0']=accessor(colors,5121,'VEC3',34962,normalized=True)
        ii=accessor(indices,5123,'SCALAR',34963)
        material={'name':name+'_vertex_colours','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.92}}
        if name=='windows':material['emissiveFactor']=[.012,.012,.012]
        materials.append(material)
        meshes.append({'name':name,'primitives':[{'attributes':attrs,'indices':ii,'material':len(materials)-1,'mode':4}]})
        node={'name':name,'mesh':len(meshes)-1}
        if any(pivot):node['translation']=pivot
        nodes.append(node)
    lo=[min(p[i] for p in world_positions) for i in range(3)];hi=[max(p[i] for p in world_positions) for i in range(3)]
    dims=[round(hi[i]-lo[i],5) for i in range(3)]
    extras={'front':'+Z','groundY':0,'dimensions':dims,'boundsMin':lo,'boundsMax':hi,'triangles':triangles,'drawCalls':len(meshes),**h.extras}
    nodes.append({'name':h.name,'children':list(range(len(nodes))),'extras':extras})
    doc={'asset':{'version':'2.0','generator':'Original pencil-town procedural architecture'},'scene':0,
         'scenes':[{'nodes':[len(nodes)-1]}],'nodes':nodes,'meshes':meshes,'materials':materials,
         'buffers':[{'byteLength':len(payload)}],'bufferViews':views,'accessors':accessors}
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);payload.extend(b'\0'*((-len(payload))%4))
    total=12+8+len(js)+8+len(payload)
    binary=struct.pack('<III',0x46546c67,2,total)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(payload),b'BIN\0')+payload
    (OUT/(h.name+'.glb')).write_bytes(binary)
    assert lo[1]>=0 and len(meshes)<=(10 if interactive else 1) and triangles<=2500,(h.name,lo,len(meshes),triangles)
    print(f'{h.name}: {len(binary):,} bytes / {triangles} triangles / {len(meshes)} draw calls / dimensions={dims}')
    return binary


def validate(binary):
    magic,version,total=struct.unpack_from('<III',binary)
    assert magic==0x46546c67 and version==2 and total==len(binary)
    size,tag=struct.unpack_from('<I4s',binary,12);assert tag==b'JSON'
    doc=json.loads(binary[20:20+size]);bo=20+size
    bs,tag=struct.unpack_from('<I4s',binary,bo);assert tag==b'BIN\0' and bo+8+bs==len(binary)
    for v in doc['bufferViews']:
        assert v['byteOffset']%4==0 and v['byteOffset']+v['byteLength']<=bs
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            ia=doc['accessors'][prim['indices']];pa=doc['accessors'][prim['attributes']['POSITION']];ca=doc['accessors'][prim['attributes']['COLOR_0']]
            assert ca['count']==pa['count'] and ca['normalized']
            view=doc['bufferViews'][ia['bufferView']]
            indices=struct.unpack_from('<'+'H'*ia['count'],binary,bo+8+view['byteOffset'])
            assert max(indices)<pa['count']


if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    for factory in (blue_gable,mint_twin,rose_arch,ochre_mansard,lilac_balcony,gallery_flat,rose_cafe):
        validate(write_glb(factory()))
    print('Validated headers, buffers, indexed geometry, per-vertex colour counts, ground, draw-call and triangle budgets.')
