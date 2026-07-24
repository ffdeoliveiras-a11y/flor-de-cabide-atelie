' ============================================================
'  Abre o sistema Flor de Cabide.
'  Garante que o servidor esteja rodando e abre no navegador.
' ============================================================
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\ADM\flor-de-cabide-atelie\backend"
' inicia o servidor (se ja estiver rodando, apenas ignora)
sh.Run """C:\Program Files\nodejs\node.exe"" server.js", 0, False
WScript.Sleep 2500
' abre o app no navegador padrao
sh.Run "http://localhost:5173/"
