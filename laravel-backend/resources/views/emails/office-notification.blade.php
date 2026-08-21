<x-mail::message>
# {{ $title }}

@if ($recipientName)
Hello {{ $recipientName }},
@else
Hello,
@endif

{{ $message }}

**Fiscal Year:** {{ $fiscalYear }}
@if ($deadline)

**PPMP Submission Deadline:** {{ $deadline }}
@endif

Please log in to the APP Consolidation System for details.

@if ($appUrl)
<x-mail::button :url="$appUrl">
Open Dashboard
</x-mail::button>
@endif

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
