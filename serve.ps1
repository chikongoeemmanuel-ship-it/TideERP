$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:8765/')
$listener.Start()
Write-Host 'Tide ERP demo is available at http://127.0.0.1:8765/'
Write-Host 'Press Ctrl+C to stop the local file server.'
try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $relative = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
      $target = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
      if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $context.Response.StatusCode = 403
        $context.Response.Close()
        continue
      }
      if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        $context.Response.StatusCode = 404
        $context.Response.Close()
        continue
      }
      $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
      $context.Response.ContentType = switch ($extension) {
        '.html' { 'text/html; charset=utf-8' }
        '.css' { 'text/css; charset=utf-8' }
        '.js' { 'text/javascript; charset=utf-8' }
        '.svg' { 'image/svg+xml' }
        '.webmanifest' { 'application/manifest+json' }
        default { 'application/octet-stream' }
      }
      $bytes = [System.IO.File]::ReadAllBytes($target)
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
      $context.Response.Headers.Add('Pragma', 'no-cache')
      if ($context.Request.HttpMethod -ne 'HEAD') {
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      $context.Response.Close()
    }
    catch {
      try { $context.Response.Close() } catch {}
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
