from django.urls import path

from .views import DashboardView, UserActivityView

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="admin_dashboard"),
    path("user-activity/", UserActivityView.as_view(), name="admin_user_activity"),
]
