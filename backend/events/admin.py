from django.contrib import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "country", "start_date", "end_date", "is_active")
    list_filter = ("is_active", "country")
    search_fields = ("name", "city", "country")
    ordering = ("start_date",)
