' ============================================================
'  Flor de Cabide - inicia o servidor automaticamente,
'  sem abrir nenhuma janela preta. Roda ao ligar o PC.
' ============================================================
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\ADM\flor-de-cabide-atelie\backend"
sh.Run """C:\Program Files\nodejs\node.exe"" server.js", 0, False
