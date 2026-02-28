import shutil
import os

src = r'C:\Users\rybki\.gemini\antigravity\brain\c2414915-6e29-4ba1-a9e8-e448ff4db547\nyx_logo_1772279065808.png'
dst = r'C:\Users\rybki\.gemini\antigravity\scratch\nyx\client\public\logo.png'

if os.path.exists(src):
    shutil.copy2(src, dst)
    print('Success')
else:
    print('Source not found')
