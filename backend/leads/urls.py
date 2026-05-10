from rest_framework.routers import DefaultRouter

from .views import ContactViewSet, LeadViewSet, PackageTierViewSet, SubPipelineViewSet

router = DefaultRouter()
router.register(r"leads", LeadViewSet, basename="lead")
router.register(r"tiers", PackageTierViewSet, basename="tier")
router.register(r"contacts", ContactViewSet, basename="contact")
router.register(r"sub-pipelines", SubPipelineViewSet, basename="sub-pipeline")

urlpatterns = router.urls
