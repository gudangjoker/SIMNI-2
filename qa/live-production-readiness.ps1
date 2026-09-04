param(
    [Parameter(Mandatory = $true)]
    [string]$FirebaseApiKey,

    [Parameter(Mandatory = $true)]
    [string]$SuperuserEmail,

    [Parameter(Mandatory = $true)]
    [string]$SuperuserPassword,

    [Parameter(Mandatory = $true)]
    [string]$VipEmail,

    [Parameter(Mandatory = $true)]
    [string]$VipPassword,

    [string]$WorkerUrl = 'https://simni-chat-media-gateway.2ndgoal.workers.dev',

    [string]$AllowedOrigin = 'https://simni.my.id',

    [string]$ReportPath = 'test-output/live-production-readiness.json'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$results = [System.Collections.Generic.List[object]]::new()
$startedAt = [DateTimeOffset]::UtcNow

function Add-TestResult {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [bool]$Passed,

        [Parameter(Mandatory = $true)]
        [string]$Details
    )

    $script:results.Add([ordered]@{
        name = $Name
        status = if ($Passed) { 'PASS' } else { 'FAIL' }
        details = $Details
    })

    if (-not $Passed) {
        throw "Uji gagal: $Name - $Details"
    }
}

function Invoke-SimniHttp {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('GET', 'POST', 'DELETE', 'OPTIONS')]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [hashtable]$Headers = @{},

        [object]$Body,

        [string]$ContentType
    )

    $parameters = @{
        Uri = $Uri
        Method = $Method
        Headers = $Headers
        SkipHttpErrorCheck = $true
        MaximumRedirection = 0
        TimeoutSec = 30
    }

    if ($PSBoundParameters.ContainsKey('Body')) {
        $parameters.Body = $Body
    }

    if ($ContentType) {
        $parameters.ContentType = $ContentType
    }

    $response = $null

    for ($attempt = 1; $attempt -le 3; $attempt += 1) {
        try {
            $response = Invoke-WebRequest @parameters
            break
        }
        catch {
            if ($attempt -eq 3) {
                throw
            }

            Start-Sleep -Milliseconds (400 * $attempt)
        }
    }

    $data = $null

    if ($response.Content) {
        try {
            $data = $response.Content | ConvertFrom-Json -Depth 32
        }
        catch {
            $data = $response.Content
        }
    }

    return [ordered]@{
        status = [int]$response.StatusCode
        headers = $response.Headers
        data = $data
        raw = $response.RawContent
    }
}

function Get-FirebaseSession {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Email,

        [Parameter(Mandatory = $true)]
        [string]$Password
    )

    $body = @{
        email = $Email
        password = $Password
        returnSecureToken = $true
    } | ConvertTo-Json -Compress

    $response = Invoke-SimniHttp `
        -Method POST `
        -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FirebaseApiKey" `
        -Body $body `
        -ContentType 'application/json'

    if ($response.status -ne 200 -or -not $response.data.idToken -or -not $response.data.localId) {
        throw "Firebase Authentication gagal untuk akun $Email dengan status $($response.status)."
    }

    return [ordered]@{
        token = [string]$response.data.idToken
        uid = [string]$response.data.localId
    }
}

function Get-AuthenticatedHeaders {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Token
    )

    return @{
        Origin = $AllowedOrigin
        Authorization = "Bearer $Token"
    }
}

function Invoke-CloudinaryUpload {
    param(
        [Parameter(Mandatory = $true)]
        [pscustomobject]$SignatureContract
    )

    $client = [System.Net.Http.HttpClient]::new()
    $client.Timeout = [TimeSpan]::FromSeconds(30)
    $form = [System.Net.Http.MultipartFormDataContent]::new()

    try {
        $fields = [ordered]@{
            api_key = [string]$SignatureContract.apiKey
            timestamp = [string]$SignatureContract.uploadParams.timestamp
            upload_preset = [string]$SignatureContract.uploadParams.upload_preset
            public_id = [string]$SignatureContract.uploadParams.public_id
            signature = [string]$SignatureContract.signature
        }

        foreach ($entry in $fields.GetEnumerator()) {
            $fieldContent = [System.Net.Http.StringContent]::new($entry.Value)
            $fieldContent.Headers.ContentDisposition = [System.Net.Http.Headers.ContentDispositionHeaderValue]::new('form-data')
            $fieldContent.Headers.ContentDisposition.Name = '"' + $entry.Key + '"'
            $form.Add($fieldContent)
        }

        $fileBytes = [System.Text.Encoding]::UTF8.GetBytes('SIMNI production integration test')
        $fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('text/plain')
        $form.Add($fileContent, 'file', 'simni-production-integration.txt')

        $uploadUri = "https://api.cloudinary.com/v1_1/$([uri]::EscapeDataString([string]$SignatureContract.cloudName))/auto/upload"
        $response = $client.PostAsync($uploadUri, $form).GetAwaiter().GetResult()
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $data = $content | ConvertFrom-Json -Depth 32

        return [ordered]@{
            status = [int]$response.StatusCode
            data = $data
        }
    }
    finally {
        $form.Dispose()
        $client.Dispose()
    }
}

try {
    $optionsResponse = Invoke-SimniHttp `
        -Method OPTIONS `
        -Uri "$WorkerUrl/v1/session/sync" `
        -Headers @{
            Origin = $AllowedOrigin
            'Access-Control-Request-Method' = 'POST'
            'Access-Control-Request-Headers' = 'authorization,content-type'
        }

    Add-TestResult `
        -Name 'CORS origin produksi diizinkan' `
        -Passed ($optionsResponse.status -eq 204 -and $optionsResponse.headers['Access-Control-Allow-Origin'] -eq $AllowedOrigin) `
        -Details "OPTIONS menghasilkan status $($optionsResponse.status)."

    $deniedOriginResponse = Invoke-SimniHttp `
        -Method OPTIONS `
        -Uri "$WorkerUrl/v1/session/sync" `
        -Headers @{
            Origin = 'https://attacker.invalid'
            'Access-Control-Request-Method' = 'POST'
        }

    Add-TestResult `
        -Name 'CORS origin asing ditolak' `
        -Passed ($deniedOriginResponse.status -eq 400 -and -not $deniedOriginResponse.headers['Access-Control-Allow-Origin']) `
        -Details "Origin asing menghasilkan status $($deniedOriginResponse.status)."

    $unauthenticatedResponse = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/session/sync" `
        -Headers @{ Origin = $AllowedOrigin } `
        -Body '{}' `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'Endpoint privat menolak request tanpa Firebase ID token' `
        -Passed ($unauthenticatedResponse.status -eq 403 -and $unauthenticatedResponse.headers['Access-Control-Allow-Origin'] -eq $AllowedOrigin) `
        -Details "Request tanpa token menghasilkan status $($unauthenticatedResponse.status)."

    $superuserSession = Get-FirebaseSession -Email $SuperuserEmail -Password $SuperuserPassword
    $vipSession = Get-FirebaseSession -Email $VipEmail -Password $VipPassword

    Add-TestResult `
        -Name 'Firebase Authentication superuser' `
        -Passed ([bool]$superuserSession.token) `
        -Details 'Firebase menerbitkan ID token superuser.'

    Add-TestResult `
        -Name 'Firebase Authentication VIP' `
        -Passed ([bool]$vipSession.token) `
        -Details 'Firebase menerbitkan ID token VIP.'

    $superuserHeaders = Get-AuthenticatedHeaders -Token $superuserSession.token
    $vipHeaders = Get-AuthenticatedHeaders -Token $vipSession.token

    $superuserSync = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/session/sync" `
        -Headers $superuserHeaders `
        -Body '{}' `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'Sinkronisasi sesi superuser' `
        -Passed ($superuserSync.status -eq 200 -and $superuserSync.data.ok -eq $true -and $superuserSync.data.membership.role -eq 'superuser') `
        -Details "Session sync menghasilkan status $($superuserSync.status) dan role superuser."

    $vipSync = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/session/sync" `
        -Headers $vipHeaders `
        -Body '{}' `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'Sinkronisasi sesi VIP' `
        -Passed ($vipSync.status -eq 200 -and $vipSync.data.ok -eq $true -and $vipSync.data.membership.role -eq 'vip') `
        -Details "Session sync menghasilkan status $($vipSync.status) dan role VIP."

    $superuserPayload = [System.Text.Encoding]::UTF8.GetBytes('SIMNI encrypted-file transport test')
    $superuserExpiry = [DateTimeOffset]::UtcNow.AddMinutes(30).ToUnixTimeMilliseconds()
    $superuserMediaHeaders = @{
        Origin = $AllowedOrigin
        Authorization = "Bearer $($superuserSession.token)"
        'X-SIMNI-Media-Type' = 'file'
        'X-SIMNI-Expires-At' = [string]$superuserExpiry
    }

    $superuserUpload = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/media/upload" `
        -Headers $superuserMediaHeaders `
        -Body $superuserPayload `
        -ContentType 'application/octet-stream'

    Add-TestResult `
        -Name 'Upload file Chat superuser ke R2' `
        -Passed ($superuserUpload.status -eq 200 -and $superuserUpload.data.ok -eq $true -and $superuserUpload.data.bytes -eq $superuserPayload.Length) `
        -Details "Upload R2 menghasilkan status $($superuserUpload.status) dan $($superuserUpload.data.bytes) byte."

    $superuserObjectKey = [string]$superuserUpload.data.objectKey
    $encodedSuperuserObjectKey = [uri]::EscapeDataString($superuserObjectKey)
    $superuserDownload = Invoke-SimniHttp `
        -Method GET `
        -Uri "$WorkerUrl/v1/media/$encodedSuperuserObjectKey" `
        -Headers $superuserHeaders

    Add-TestResult `
        -Name 'Download file Chat superuser dari R2' `
        -Passed ($superuserDownload.status -eq 200 -and $superuserDownload.headers['X-SIMNI-Media-Type'] -eq 'file') `
        -Details "Download R2 menghasilkan status $($superuserDownload.status)."

    $superuserDelete = Invoke-SimniHttp `
        -Method DELETE `
        -Uri "$WorkerUrl/v1/media/$encodedSuperuserObjectKey" `
        -Headers $superuserHeaders

    Add-TestResult `
        -Name 'Penghapusan file uji superuser dari R2' `
        -Passed ($superuserDelete.status -eq 200 -and $superuserDelete.data.deleted -eq $true) `
        -Details "Delete R2 menghasilkan status $($superuserDelete.status)."

    $vipPayload = [System.Text.Encoding]::UTF8.GetBytes('SIMNI encrypted-audio transport test')
    $vipExpiry = [DateTimeOffset]::UtcNow.AddMinutes(30).ToUnixTimeMilliseconds()
    $vipMediaHeaders = @{
        Origin = $AllowedOrigin
        Authorization = "Bearer $($vipSession.token)"
        'X-SIMNI-Media-Type' = 'audio'
        'X-SIMNI-Expires-At' = [string]$vipExpiry
    }

    $vipUpload = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/media/upload" `
        -Headers $vipMediaHeaders `
        -Body $vipPayload `
        -ContentType 'application/octet-stream'

    Add-TestResult `
        -Name 'Upload voice note VIP ke R2' `
        -Passed ($vipUpload.status -eq 200 -and $vipUpload.data.ok -eq $true -and $vipUpload.data.bytes -eq $vipPayload.Length) `
        -Details "Upload audio R2 menghasilkan status $($vipUpload.status) dan $($vipUpload.data.bytes) byte."

    $vipObjectKey = [string]$vipUpload.data.objectKey
    $encodedVipObjectKey = [uri]::EscapeDataString($vipObjectKey)
    $vipDelete = Invoke-SimniHttp `
        -Method DELETE `
        -Uri "$WorkerUrl/v1/media/$encodedVipObjectKey" `
        -Headers $vipHeaders

    Add-TestResult `
        -Name 'Penghapusan voice note uji VIP dari R2' `
        -Passed ($vipDelete.status -eq 200 -and $vipDelete.data.deleted -eq $true) `
        -Details "Delete audio R2 menghasilkan status $($vipDelete.status)."

    $cloudinarySignBody = @{
        purpose = 'document'
        fileSize = 33
        mime = 'text/plain'
    } | ConvertTo-Json -Compress

    $cloudinarySign = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/cloudinary/sign" `
        -Headers $superuserHeaders `
        -Body $cloudinarySignBody `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'Penerbitan signed upload contract Cloudinary' `
        -Passed ($cloudinarySign.status -eq 200 -and $cloudinarySign.data.ok -eq $true -and $cloudinarySign.data.uploadParams.upload_preset -eq 'simni_lkpd_dokumen_signed') `
        -Details "Worker menerbitkan signed contract dengan status $($cloudinarySign.status)."

    $cloudinaryUpload = Invoke-CloudinaryUpload -SignatureContract $cloudinarySign.data

    $cloudinaryReturnedPublicId = [string]$cloudinaryUpload.data.public_id
    $signedPublicId = [string]$cloudinarySign.data.publicId
    $cloudinaryPublicIdMatches =
        $cloudinaryReturnedPublicId -eq $signedPublicId -or
        (
            [string]$cloudinaryUpload.data.resource_type -eq 'raw' -and
            $cloudinaryReturnedPublicId -match ('^' + [regex]::Escape($signedPublicId) + '\.[a-zA-Z0-9]{1,16}$')
        )

    Add-TestResult `
        -Name 'Upload dokumen uji ke Cloudinary signed preset' `
        -Passed ($cloudinaryUpload.status -ge 200 -and $cloudinaryUpload.status -lt 300 -and $cloudinaryPublicIdMatches) `
        -Details "Cloudinary menerima signed upload dengan status $($cloudinaryUpload.status)."

    $cloudinaryDeleteBody = @{
        purpose = 'document'
        publicId = [string]$cloudinaryUpload.data.public_id
        resourceType = [string]$cloudinaryUpload.data.resource_type
    } | ConvertTo-Json -Compress

    $cloudinaryDelete = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/cloudinary/delete" `
        -Headers $superuserHeaders `
        -Body $cloudinaryDeleteBody `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'Penghapusan dokumen uji dari Cloudinary' `
        -Passed ($cloudinaryDelete.status -eq 200 -and $cloudinaryDelete.data.deleted -eq $true) `
        -Details "Cleanup Cloudinary menghasilkan status $($cloudinaryDelete.status)."

    $vipCloudinarySign = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/cloudinary/sign" `
        -Headers $vipHeaders `
        -Body $cloudinarySignBody `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'VIP ditolak dari upload dokumen Cloudinary' `
        -Passed ($vipCloudinarySign.status -ge 400 -and $vipCloudinarySign.data.ok -eq $false -and -not $vipCloudinarySign.data.signature) `
        -Details "Permintaan VIP ditolak dengan status $($vipCloudinarySign.status)."

    $pushBody = @{
        recipientUid = $vipSession.uid
    } | ConvertTo-Json -Compress

    $pushResult = Invoke-SimniHttp `
        -Method POST `
        -Uri "$WorkerUrl/v1/push" `
        -Headers $superuserHeaders `
        -Body $pushBody `
        -ContentType 'application/json'

    Add-TestResult `
        -Name 'Pipeline notifikasi FCM superuser ke VIP' `
        -Passed ($pushResult.status -eq 200 -and $pushResult.data.ok -eq $true -and [int]$pushResult.data.delivered -le [int]$pushResult.data.attempted) `
        -Details "FCM menghasilkan attempted=$($pushResult.data.attempted), delivered=$($pushResult.data.delivered)."
}
catch {
    $results.Add([ordered]@{
        name = 'Eksekusi readiness suite'
        status = 'FAIL'
        details = $_.Exception.Message
    })
}
finally {
    $passed = @($results | Where-Object { $_.status -eq 'PASS' }).Count
    $failed = @($results | Where-Object { $_.status -eq 'FAIL' }).Count
    $report = [ordered]@{
        suite = 'SIMNI live production readiness'
        appVersion = '4.6.3'
        workerUrl = $WorkerUrl
        allowedOrigin = $AllowedOrigin
        startedAt = $startedAt.ToString('o')
        completedAt = [DateTimeOffset]::UtcNow.ToString('o')
        summary = [ordered]@{
            passed = $passed
            failed = $failed
            total = $results.Count
        }
        tests = $results
    }

    $resolvedReportPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $ReportPath))
    $reportDirectory = [System.IO.Path]::GetDirectoryName($resolvedReportPath)
    [System.IO.Directory]::CreateDirectory($reportDirectory) | Out-Null
    $report | ConvertTo-Json -Depth 32 | Set-Content -LiteralPath $resolvedReportPath -Encoding UTF8
    $report | ConvertTo-Json -Depth 32

    if ($failed -gt 0) {
        exit 1
    }
}
